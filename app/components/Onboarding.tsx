"use client";

import { useEffect, useState, type FormEvent } from "react";
import { errorText } from "@/lib/i18n";
import { MAX_PLAYERS, MIN_PLAYERS, PLAYER_COLORS, type GroupSummary, type Scoreboard } from "@/lib/scoreboard";
import { deleteGroup, errorCodeOf, fetchGroups, sendMutation } from "@/lib/scoresClient";
import { formatDay } from "@/lib/stats";
import { useI18n } from "./i18n";
import { ColorPicker, playerStyle } from "./players";
import { chooseGroup } from "./session";

/** "Who's playing?": pick saved players or enter new ones. Shown on the scoreboard until this device picks. */
export function PlayerPicker() {
  const { t } = useI18n();
  const [groups, setGroups] = useState<GroupSummary[] | null>(null);
  const [error, setError] = useState("");

  const load = () => {
    fetchGroups().then(setGroups, (err) => setError(errorCodeOf(err)));
  };
  useEffect(load, []);

  const o = t.onboarding;
  return (
    <main className="picker">
      {!groups && !error && <p className="loading">{t.scores.loading}</p>}
      {error && (
        <div className="notice" role="alert">
          {errorText(t, error)}{" "}
          <button
            type="button"
            className="pill"
            onClick={() => {
              setError("");
              load();
            }}
          >
            {t.scores.retry}
          </button>
        </div>
      )}

      {groups && groups.length > 0 && (
        <section className="panel" aria-labelledby="pick-title">
          <h2 id="pick-title" className="panel-title">
            {o.pickTitle}
          </h2>
          <p className="setup-lede">{o.pickLede}</p>
          <ul className="group-list">
            {groups.map((g) => (
              <GroupRow key={g.id} group={g} onDeleted={setGroups} />
            ))}
          </ul>
        </section>
      )}

      {groups && (
        <section className="panel" aria-labelledby="setup-title">
          <PlayerSetupForm onDone={chooseGroup} />
        </section>
      )}
    </main>
  );
}

function GroupRow({ group, onDeleted }: { group: GroupSummary; onDeleted: (groups: GroupSummary[]) => void }) {
  const { t } = useI18n();
  const o = t.onboarding;
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState("");

  const meta = group.lastPlayedOn
    ? o.groupMeta(group.gameCount, formatDay(group.lastPlayedOn, t.locale))
    : o.noGames;

  return (
    <li className="group-row">
      <button type="button" className="group-pick" onClick={() => chooseGroup(group)}>
        <span className="group-players">
          {group.players.map((p) => (
            <span key={p.id} style={playerStyle(p.color)}>
              <span className="dot" aria-hidden="true" /> {p.name}
            </span>
          ))}
        </span>
        <span className="group-meta">{meta}</span>
      </button>
      {confirming ? (
        <span className="confirm">
          {o.confirmDelete(group.gameCount)}
          <button
            type="button"
            className="link danger"
            onClick={() => deleteGroup(group.id).then(onDeleted, (err) => setError(errorText(t, errorCodeOf(err))))}
          >
            {t.scores.yesDelete}
          </button>
          <button type="button" className="link" onClick={() => setConfirming(false)}>
            {t.scores.cancel}
          </button>
        </span>
      ) : (
        <button type="button" className="link" onClick={() => setConfirming(true)}>
          {t.scores.delete}
        </button>
      )}
      {error && (
        <p className="notice" role="alert">
          {error}
        </p>
      )}
    </li>
  );
}

/** Enter 2–5 player names to start a new player group. */
export function PlayerSetupForm({ onDone }: { onDone: (board: Scoreboard) => void }) {
  const { t } = useI18n();
  const [rows, setRows] = useState([
    { name: "", color: PLAYER_COLORS[0] as string },
    { name: "", color: PLAYER_COLORS[1] as string },
  ]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const ready = rows.every((r) => r.name.trim());

  const setName = (i: number, name: string) => setRows((prev) => prev.map((r, j) => (j === i ? { ...r, name } : r)));
  // Picking a color another row has swaps the two, like on the scoreboard.
  const setColor = (i: number, color: string) =>
    setRows((prev) =>
      prev.map((r, j) => (j === i ? { ...r, color } : r.color === color ? { ...r, color: prev[i].color } : r)),
    );
  const addRow = () =>
    setRows((prev) => [
      ...prev,
      { name: "", color: PLAYER_COLORS.find((c) => !prev.some((r) => r.color === c)) ?? PLAYER_COLORS[0] },
    ]);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!ready || saving) return;
    setSaving(true);
    setError("");
    try {
      onDone(
        await sendMutation({
          type: "createGroup",
          id: crypto.randomUUID(),
          names: rows.map((r) => r.name),
          colors: rows.map((r) => r.color),
        }),
      );
    } catch (err) {
      setError(errorText(t, errorCodeOf(err)));
      setSaving(false);
    }
  };

  return (
    <>
      <h2 id="setup-title" className="panel-title">
        {t.setup.title}
      </h2>
      <p className="setup-lede">{t.setup.lede}</p>
      <form onSubmit={onSubmit}>
        {rows.map((row, i) => (
          <div key={i} className="setup-field" style={playerStyle(row.color)}>
            <div className="setup-label-row">
              <label htmlFor={`setup-name-${i}`}>
                <span className="dot" aria-hidden="true" /> {t.setup.player(i + 1)}
              </label>
              <ColorPicker
                value={row.color}
                onChange={(color) => setColor(i, color)}
                label={t.scores.colorOf(row.name.trim() || t.setup.player(i + 1))}
              />
            </div>
            <div className="setup-input-row">
              <input
                id={`setup-name-${i}`}
                value={row.name}
                maxLength={24}
                autoComplete="off"
                autoCapitalize="words"
                enterKeyHint={i === rows.length - 1 ? "done" : "next"}
                placeholder={t.setup.placeholders[i]}
                onChange={(e) => setName(i, e.target.value)}
              />
              {rows.length > MIN_PLAYERS && (
                <button
                  type="button"
                  className="remove-row"
                  aria-label={t.setup.removeRow(i + 1)}
                  onClick={() => setRows((prev) => prev.filter((_, j) => j !== i))}
                >
                  ×
                </button>
              )}
            </div>
          </div>
        ))}
        {rows.length < MAX_PLAYERS && (
          <button type="button" className="pill" onClick={addRow}>
            {t.setup.addRow}
          </button>
        )}
        {error && (
          <p className="notice" role="alert">
            {error}
          </p>
        )}
        <button type="submit" className="send send-wide" disabled={!ready || saving}>
          {saving ? t.setup.saving : t.setup.start}
        </button>
      </form>
    </>
  );
}
