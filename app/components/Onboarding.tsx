"use client";

import { useEffect, useState, type CSSProperties, type FormEvent, type ReactNode } from "react";
import { errorText } from "@/lib/i18n";
import { MAX_PLAYERS, MIN_PLAYERS, PLAYER_COLORS, type GroupSummary, type Scoreboard } from "@/lib/scoreboard";
import { deleteGroup, errorCodeOf, fetchGroups, sendMutation } from "@/lib/scoresClient";
import { formatDay } from "@/lib/stats";
import { LanguageSwitch, useI18n } from "./i18n";
import { chooseGroup, useGroupId } from "./session";

/** Shows the player picker until this device has chosen a player group. */
export function OnboardingGate({ children }: { children: ReactNode }) {
  const groupId = useGroupId();
  return groupId === null ? <PlayerPicker /> : children;
}

function PlayerPicker() {
  const { t } = useI18n();
  const [groups, setGroups] = useState<GroupSummary[] | null>(null);
  const [error, setError] = useState("");

  const load = () => {
    fetchGroups().then(setGroups, (err) => setError(errorCodeOf(err)));
  };
  useEffect(load, []);

  const o = t.onboarding;
  return (
    <div className="page onboarding">
      <div className="topbar">
        <LanguageSwitch />
      </div>
      <header className="hero">
        <div className="terrain-strip" aria-hidden="true">
          {["grass", "canyon", "desert", "flower", "forest"].map((x) => (
            <span key={x} className={`hex hex-${x}`} />
          ))}
        </div>
        <p className="eyebrow" lang="en">
          Kingdom Builder
        </p>
        <h1>{o.title}</h1>
        <p className="lede">{o.intro}</p>
        <ul className="features">
          {o.features.map((f) => (
            <li key={f}>{f}</li>
          ))}
        </ul>
      </header>

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
    </div>
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
            <span key={p.id} style={{ "--player": p.color } as CSSProperties}>
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
  const [names, setNames] = useState(["", ""]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const ready = names.every((n) => n.trim());

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!ready || saving) return;
    setSaving(true);
    setError("");
    try {
      onDone(await sendMutation({ type: "createGroup", id: crypto.randomUUID(), names }));
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
        {names.map((value, i) => (
          <div key={i} className="setup-field" style={{ "--player": PLAYER_COLORS[i] } as CSSProperties}>
            <label htmlFor={`setup-name-${i}`}>
              <span className="dot" aria-hidden="true" /> {t.setup.player(i + 1)}
            </label>
            <div className="setup-input-row">
              <input
                id={`setup-name-${i}`}
                value={value}
                maxLength={24}
                autoComplete="off"
                autoCapitalize="words"
                enterKeyHint={i === names.length - 1 ? "done" : "next"}
                placeholder={t.setup.placeholders[i]}
                onChange={(e) => setNames((prev) => prev.map((n, j) => (j === i ? e.target.value : n)))}
              />
              {names.length > MIN_PLAYERS && (
                <button
                  type="button"
                  className="remove-row"
                  aria-label={t.setup.removeRow(i + 1)}
                  onClick={() => setNames((prev) => prev.filter((_, j) => j !== i))}
                >
                  ×
                </button>
              )}
            </div>
          </div>
        ))}
        {names.length < MAX_PLAYERS && (
          <button type="button" className="pill" onClick={() => setNames((prev) => [...prev, ""])}>
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
