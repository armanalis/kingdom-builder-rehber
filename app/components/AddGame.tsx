"use client";

import { useState, useSyncExternalStore, type CSSProperties, type FormEvent, type KeyboardEvent } from "react";
import { ALL_COMPONENTS } from "@/lib/cards";
import { errorText } from "@/lib/i18n";
import { KB_CARD_NAMES, MAX_GOLD, type GroupMutation, type Player, type Scoreboard } from "@/lib/scoreboard";
import { errorCodeOf } from "@/lib/scoresClient";
import { fieldId, playerTotal, ruleGold, rulesFor, type Counts, type ScoreRule } from "@/lib/scoring";
import { todayLocal } from "@/lib/stats";
import { ComponentImage } from "./CardGuide";
import { useI18n } from "./i18n";

type Change = GroupMutation extends infer M ? (M extends GroupMutation ? Omit<M, "groupId"> : never) : never;
type Mode = "calc" | "total";

// Remembered per device: calculator or typing the totals.
const MODE_KEY = "kb-entry-mode";
const modeListeners = new Set<() => void>();
const subscribeMode = (l: () => void) => {
  modeListeners.add(l);
  return () => modeListeners.delete(l);
};
const getMode = (): Mode => (localStorage.getItem(MODE_KEY) === "total" ? "total" : "calc");
const setMode = (mode: Mode) => {
  localStorage.setItem(MODE_KEY, mode);
  modeListeners.forEach((l) => l());
};

/** Enter moves to the next number box, so counts can be typed in one go. */
function focusNext(e: KeyboardEvent<HTMLInputElement>) {
  if (e.key !== "Enter") return;
  e.preventDefault();
  const inputs = [...(e.currentTarget.form?.querySelectorAll<HTMLInputElement>("input[data-count]") ?? [])];
  inputs[inputs.indexOf(e.currentTarget) + 1]?.focus();
}

export function AddGameForm({
  board,
  mutate,
  onSaved,
}: {
  board: Scoreboard;
  mutate: (change: Change) => Promise<Scoreboard>;
  onSaved: (after: Scoreboard, gameId: string) => void;
}) {
  const { t } = useI18n();
  const mode = useSyncExternalStore(subscribeMode, getMode, () => "calc" as Mode);
  const last = board.games.at(-1);
  const [playing, setPlaying] = useState<Set<string>>(
    () => new Set(last ? last.scores.map((s) => s.playerId) : board.players.map((p) => p.id)),
  );
  // Several games in one evening usually reuse the same cards.
  const [cards, setCards] = useState<string[]>(() => (last?.playedOn === todayLocal() ? (last.cards ?? []) : []));
  const [gold, setGold] = useState<Record<string, string>>({});
  const [counts, setCounts] = useState<Counts>({});
  const [day, setDay] = useState(todayLocal);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const players = board.players.filter((p) => playing.has(p.id));
  const totals = players.map((p) => {
    if (mode === "calc") return { player: p, gold: playerTotal(cards, counts[p.id]) };
    const raw = gold[p.id] ?? "";
    return { player: p, gold: /^\d+$/.test(raw) && Number(raw) <= MAX_GOLD ? Number(raw) : null };
  });
  const ready = players.length >= 2 && totals.every((x) => x.gold !== null);

  const preview = (() => {
    if (!ready) return "";
    const ranked = [...totals].sort((a, b) => b.gold! - a.gold!);
    const top = ranked[0].gold!;
    const tied = ranked.filter((x) => x.gold === top);
    if (tied.length > 1) return t.scores.previewTie(tied.map((x) => x.player.name).join(` ${t.and} `));
    const next = ranked.find((x) => x.gold! < top)!;
    return t.scores.previewWin(ranked[0].player.name, top - next.gold!);
  })();

  const togglePlayer = (id: string) =>
    setPlaying((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const toggleCard = (card: string) =>
    setCards((prev) => (prev.includes(card) ? prev.filter((c) => c !== card) : prev.length < 3 ? [...prev, card] : prev));

  const setCount = (playerId: string, key: string, value: string) =>
    setCounts((prev) => ({ ...prev, [playerId]: { ...prev[playerId], [key]: value } }));

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!ready || saving) return;
    setSaving(true);
    setError("");
    const id = crypto.randomUUID();
    try {
      const after = await mutate({
        type: "addGame",
        game: {
          id,
          playedOn: day,
          scores: totals.map((x) => ({ playerId: x.player.id, gold: x.gold! })),
          cards,
        },
      });
      setGold({});
      setCounts({});
      setDay(todayLocal());
      onSaved(after, id);
    } catch (err) {
      setError(errorText(t, errorCodeOf(err)));
    } finally {
      setSaving(false);
    }
  };

  const s = t.scores;
  return (
    <section className="panel area-add" aria-labelledby="add-title">
      <h2 id="add-title" className="panel-title">
        {s.addTitle}
      </h2>

      <div className="mode-switch" role="group" aria-label={s.addTitle}>
        <button type="button" aria-pressed={mode === "calc"} onClick={() => setMode("calc")}>
          {s.modeCalc}
        </button>
        <button type="button" aria-pressed={mode === "total"} onClick={() => setMode("total")}>
          {s.modeTotal}
        </button>
      </div>

      <form onSubmit={onSubmit}>
        {mode === "calc" ? (
          <>
            <p className="calc-step">{s.whoPlayed}</p>
            <div className="who-played">
              {board.players.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  className="chip"
                  aria-pressed={playing.has(p.id)}
                  style={{ "--player": p.color } as CSSProperties}
                  onClick={() => togglePlayer(p.id)}
                >
                  <span className="dot" aria-hidden="true" /> {p.name}
                </button>
              ))}
            </div>

            <p className="calc-step">{s.cardsPick}</p>
            <CardPicker selected={cards} onToggle={toggleCard} />
            {cards.length === 0 && <p className="calc-hint">{s.cardsPickHint}</p>}

            <p className="calc-hint">{s.calcHint}</p>
            <div className="calc-players">
              {players.map((p) => (
                <PlayerCalc
                  key={p.id}
                  player={p}
                  rules={rulesFor(cards)}
                  values={counts[p.id]}
                  onChange={(key, value) => setCount(p.id, key, value)}
                  total={playerTotal(cards, counts[p.id])}
                />
              ))}
            </div>
          </>
        ) : (
          <div className="score-inputs">
            {board.players.map((p) => {
              const on = playing.has(p.id);
              return (
                <div key={p.id} className={`score-row${on ? "" : " is-off"}`} style={{ "--player": p.color } as CSSProperties}>
                  <label className="score-player">
                    <input type="checkbox" checked={on} onChange={() => togglePlayer(p.id)} />
                    <span className="dot" aria-hidden="true" />
                    <span className="score-player-name">{p.name}</span>
                  </label>
                  {on && (
                    <label className="gold-input">
                      <span className="visually-hidden">{s.goldOf(p.name)}</span>
                      <input
                        type="number"
                        inputMode="numeric"
                        min={0}
                        max={MAX_GOLD}
                        placeholder="0"
                        data-count
                        enterKeyHint="next"
                        onKeyDown={focusNext}
                        value={gold[p.id] ?? ""}
                        onChange={(e) => setGold((g) => ({ ...g, [p.id]: e.target.value }))}
                      />
                      <span aria-hidden="true">{s.gold}</span>
                    </label>
                  )}
                </div>
              );
            })}
          </div>
        )}

        <details className="more-options">
          <summary>{mode === "calc" ? s.moreOptionsDate : s.moreOptions}</summary>
          <label className="date-row">
            {s.date}
            <input type="date" value={day} max={todayLocal()} onChange={(e) => setDay(e.target.value || todayLocal())} />
          </label>
          {mode === "total" && (
            <>
              <p className="cards-hint">{s.cardsHint}</p>
              <CardPicker selected={cards} onToggle={toggleCard} />
            </>
          )}
        </details>

        {preview && <p className="preview">{preview}</p>}
        {error && (
          <p className="notice" role="alert">
            {error}
          </p>
        )}
        <button type="submit" className="send send-wide" disabled={!ready || saving}>
          {saving ? s.saving : s.save}
        </button>
      </form>
    </section>
  );
}

function CardPicker({ selected, onToggle }: { selected: string[]; onToggle: (card: string) => void }) {
  return (
    <div className="card-picker" lang="en">
      {KB_CARD_NAMES.map((name) => {
        const item = ALL_COMPONENTS.find((c) => c.name === name)!;
        return (
          <button key={name} type="button" className="card-pick" aria-pressed={selected.includes(name)} onClick={() => onToggle(name)}>
            <ComponentImage item={item} size="mini" />
            <span>{name}</span>
          </button>
        );
      })}
    </div>
  );
}

function PlayerCalc({
  player,
  rules,
  values,
  onChange,
  total,
}: {
  player: Player;
  rules: ScoreRule[];
  values: Record<string, string> | undefined;
  onChange: (key: string, value: string) => void;
  total: number;
}) {
  const { lang, t } = useI18n();
  return (
    <fieldset className="calc-player" style={{ "--player": player.color } as CSSProperties}>
      <legend>
        <span className="dot" aria-hidden="true" /> {player.name}
        <span className="calc-total">
          {t.scores.total}: <strong>{total}</strong>
        </span>
      </legend>
      {rules.map((rule) => {
        const item = ALL_COMPONENTS.find((c) => c.name === rule.id);
        return (
          <div key={rule.id} className="calc-rule">
            <div className="calc-rule-head">
              {item ? <ComponentImage item={item} size="mini" /> : <span className="calc-castle" aria-hidden="true">🏰</span>}
              <span className="calc-rule-name" lang={item ? "en" : undefined}>
                {item ? item.name : t.scores.castles}
              </span>
              <span className="calc-rule-gold">= {ruleGold(rule, values)}</span>
            </div>
            {rule.fields.map((field) => {
              const key = fieldId(rule, field);
              const id = `count-${player.id}-${key}`;
              return (
                <div key={key} className="calc-field">
                  <label htmlFor={id}>{field.label[lang]}</label>
                  <input
                    id={id}
                    type="number"
                    inputMode="numeric"
                    min={0}
                    max={field.max}
                    placeholder="0"
                    data-count
                    enterKeyHint="next"
                    onKeyDown={focusNext}
                    value={values?.[key] ?? ""}
                    onChange={(e) => onChange(key, e.target.value)}
                  />
                  <span className="calc-rate">{field.rate}</span>
                </div>
              );
            })}
            {rule.hint && <p className="calc-hint">{rule.hint[lang]}</p>}
          </div>
        );
      })}
    </fieldset>
  );
}
