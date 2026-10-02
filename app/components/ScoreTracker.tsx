"use client";

import { useCallback, useEffect, useMemo, useState, type CSSProperties, type FormEvent } from "react";
import { errorText } from "@/lib/i18n";
import { KB_CARD_NAMES, MAX_GOLD, MAX_PLAYERS, needsSetup, type Game, type Mutation, type Scoreboard } from "@/lib/scoreboard";
import { errorCodeOf, fetchScoreboard, sendMutation } from "@/lib/scoresClient";
import {
  activePlayers,
  comparisons,
  formatDay,
  outcomes,
  playerStats,
  sharedFacts,
  todayLocal,
  type Comparison,
  type Fact,
  type Outcome,
  type PlayerStats,
} from "@/lib/stats";
import { useI18n } from "./i18n";
import { PlayerSetupForm } from "./Onboarding";
import { SiteNav } from "./SiteNav";

type Toast = { text: string; undo?: Game };
type Mutate = (m: Mutation) => Promise<Scoreboard>;

export function ScoreTracker() {
  const { t } = useI18n();
  const [board, setBoard] = useState<Scoreboard | null>(null);
  const [loadError, setLoadError] = useState("");
  const [toast, setToast] = useState<Toast | null>(null);

  const load = useCallback(() => {
    fetchScoreboard().then(setBoard, (err) => setLoadError(errorCodeOf(err)));
  }, []);

  useEffect(load, [load]);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), toast.undo ? 10000 : 6000);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const mutate = useCallback<Mutate>(async (mutation) => {
    const next = await sendMutation(mutation);
    setBoard(next);
    return next;
  }, []);

  const results = useMemo(() => (board ? outcomes(board) : []), [board]);
  const stats = useMemo(() => (board ? playerStats(board, results) : []), [board, results]);
  const facts = useMemo(() => sharedFacts(results, t), [results, t]);
  const rows = useMemo(
    () => (board ? comparisons(activePlayers(board, stats), results, t) : []),
    [board, stats, results, t],
  );

  const onSaved = (before: Outcome[], after: Scoreboard, gameId: string) => {
    const r = outcomes(after).find((o) => o.game.id === gameId);
    if (!r) return;
    const prevRecord = Math.max(0, ...before.filter((o) => o.winners.length === 1).map((o) => o.margin));
    const prevHigh = Math.max(0, ...before.flatMap((o) => o.ranked.map((x) => x.gold)));
    let text =
      r.winners.length > 1
        ? t.scores.savedTie(r.winners.map((w) => w.name).join(` ${t.and} `))
        : t.scores.savedWin(r.winners[0].name, r.margin);
    if (before.length > 0 && r.winners.length === 1 && r.margin > prevRecord) text += t.scores.newRecord;
    else if (before.length > 0 && r.ranked[0].gold > prevHigh) text += t.scores.newHigh;
    setToast({ text });
  };

  return (
    <div className="page page-scores">
      <SiteNav />
      <header className="hero hero-compact">
        <p className="eyebrow" lang="en">
          Kingdom Builder
        </p>
        <h1>{t.scores.title}</h1>
        <p className="lede">{t.scores.lede}</p>
      </header>

      {loadError && (
        <div className="notice" role="alert">
          {errorText(t, loadError)}{" "}
          <button
            type="button"
            className="pill"
            onClick={() => {
              setLoadError("");
              load();
            }}
          >
            {t.scores.retry}
          </button>
        </div>
      )}

      {!board && !loadError && <p className="loading">{t.scores.loading}</p>}

      {board && needsSetup(board) && (
        <section className="panel setup-panel" aria-labelledby="setup-title">
          <PlayerSetupForm onDone={setBoard} />
        </section>
      )}

      {board && !needsSetup(board) && (
        <main className="score-main">
          <Leaderboard stats={stats} totalGames={results.length} />
          <AddGameForm board={board} mutate={mutate} onSaved={(after, id) => onSaved(results, after, id)} />
          {results.length > 0 && <Stats facts={facts} rows={rows} />}
          {results.length > 0 && (
            <History
              results={results}
              onDelete={async (game) => {
                try {
                  await mutate({ type: "deleteGame", id: game.id });
                  setToast({ text: t.scores.deleted(formatDay(game.playedOn, t.locale)), undo: game });
                } catch (err) {
                  setToast({ text: errorText(t, errorCodeOf(err)) });
                }
              }}
            />
          )}
          <Players board={board} mutate={mutate} />
        </main>
      )}

      {toast && (
        <div className="toast" role="status">
          <span>{toast.text}</span>
          {toast.undo && (
            <button
              type="button"
              onClick={() => {
                const game = toast.undo!;
                setToast(null);
                void mutate({ type: "addGame", game }).catch(() => setToast({ text: t.errors.undo_failed }));
              }}
            >
              {t.scores.undo}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function Leaderboard({ stats, totalGames }: { stats: PlayerStats[]; totalGames: number }) {
  const { t } = useI18n();
  const maxWins = Math.max(...stats.map((s) => s.wins));
  const leaders = stats.filter((s) => s.wins === maxWins && maxWins > 0);
  return (
    <section className="leaderboard area-lead" aria-label={t.scores.winsAria}>
      {stats.map((s) => {
        const leading = leaders.length === 1 && leaders[0] === s;
        return (
          <div
            key={s.player.id}
            className={`leader-card${leading ? " is-leading" : ""}`}
            style={{ "--player": s.player.color } as CSSProperties}
          >
            {leading && (
              <span className="crown" role="img" aria-label={t.scores.leading}>
                👑
              </span>
            )}
            <span className="leader-name">{s.player.name}</span>
            <span className="leader-wins">{s.wins}</span>
            <span className="leader-label">{t.scores.wins}</span>
            <span className="leader-meta">
              {t.scores.games(s.played)}
              {s.played ? ` · ${Math.round(s.winRate * 100)}%` : ""}
              {s.draws ? ` · ${t.scores.draws(s.draws)}` : ""}
            </span>
          </div>
        );
      })}
      {totalGames === 0 && <p className="empty">{t.scores.empty}</p>}
    </section>
  );
}

function AddGameForm({
  board,
  mutate,
  onSaved,
}: {
  board: Scoreboard;
  mutate: Mutate;
  onSaved: (after: Scoreboard, gameId: string) => void;
}) {
  const { t } = useI18n();
  const [playing, setPlaying] = useState<Set<string>>(() => {
    const last = board.games.at(-1);
    return new Set(last ? last.scores.map((s) => s.playerId) : board.players.map((p) => p.id));
  });
  const [gold, setGold] = useState<Record<string, string>>({});
  const [day, setDay] = useState(todayLocal);
  const [cards, setCards] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const entries = board.players.filter((p) => playing.has(p.id)).map((p) => ({ player: p, value: gold[p.id] ?? "" }));
  const ready = entries.length >= 2 && entries.every((e) => /^\d+$/.test(e.value) && Number(e.value) <= MAX_GOLD);

  const preview = (() => {
    if (!ready) return "";
    const ranked = [...entries].sort((a, b) => Number(b.value) - Number(a.value));
    const top = Number(ranked[0].value);
    const tied = ranked.filter((e) => Number(e.value) === top);
    if (tied.length > 1) return t.scores.previewTie(tied.map((e) => e.player.name).join(` ${t.and} `));
    const next = ranked.find((e) => Number(e.value) < top)!;
    return t.scores.previewWin(ranked[0].player.name, top - Number(next.value));
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
          scores: entries.map((x) => ({ playerId: x.player.id, gold: Number(x.value) })),
          cards,
        },
      });
      setGold({});
      setCards([]);
      setDay(todayLocal());
      onSaved(after, id);
    } catch (err) {
      setError(errorText(t, errorCodeOf(err)));
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="panel area-add" aria-labelledby="add-title">
      <h2 id="add-title" className="panel-title">
        {t.scores.addTitle}
      </h2>
      <form onSubmit={onSubmit}>
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
                    <span className="visually-hidden">{t.scores.goldOf(p.name)}</span>
                    <input
                      type="number"
                      inputMode="numeric"
                      min={0}
                      max={MAX_GOLD}
                      placeholder="0"
                      value={gold[p.id] ?? ""}
                      onChange={(e) => setGold((g) => ({ ...g, [p.id]: e.target.value }))}
                    />
                    <span aria-hidden="true">{t.scores.gold}</span>
                  </label>
                )}
              </div>
            );
          })}
        </div>

        <details className="more-options">
          <summary>{t.scores.moreOptions}</summary>
          <label className="date-row">
            {t.scores.date}
            <input type="date" value={day} max={todayLocal()} onChange={(e) => setDay(e.target.value || todayLocal())} />
          </label>
          <p className="cards-hint">{t.scores.cardsHint}</p>
          <div className="card-chips" lang="en">
            {KB_CARD_NAMES.map((c) => (
              <button key={c} type="button" className="chip" aria-pressed={cards.includes(c)} onClick={() => toggleCard(c)}>
                {c}
              </button>
            ))}
          </div>
        </details>

        {preview && <p className="preview">{preview}</p>}
        {error && (
          <p className="notice" role="alert">
            {error}
          </p>
        )}
        <button type="submit" className="send send-wide" disabled={!ready || saving}>
          {saving ? t.scores.saving : t.scores.save}
        </button>
      </form>
    </section>
  );
}

function Stats({ facts, rows }: { facts: Fact[]; rows: Comparison[] }) {
  const { t } = useI18n();
  return (
    <section className="area-stats" aria-labelledby="facts-title">
      <h2 id="facts-title" className="section-title">
        {t.scores.statsTitle}
      </h2>
      {facts.length > 0 && (
        <div className="facts">
          {facts.map((f) => (
            <article key={f.title} className="fact">
              <span className="fact-icon" aria-hidden="true">
                {f.icon}
              </span>
              <div>
                <h3>{f.title}</h3>
                <p>{f.text}</p>
              </div>
            </article>
          ))}
        </div>
      )}
      <h3 className="subsection-title">{t.scores.compareTitle}</h3>
      <div className="compare">
        {rows.map((row) => (
          <article key={row.title} className="compare-row">
            <h4>
              <span aria-hidden="true">{row.icon}</span> {row.title}
            </h4>
            <div className="compare-cells">
              {row.cells.map((c) => (
                <div
                  key={c.player.id}
                  className={`compare-cell${c.best ? " is-best" : ""}`}
                  style={{ "--player": c.player.color } as CSSProperties}
                >
                  <span className="compare-name">
                    <span className="dot" aria-hidden="true" /> {c.player.name}
                    {c.best && <span className="visually-hidden"> {t.scores.leadingSr}</span>}
                  </span>
                  <span className="compare-value">{c.text}</span>
                </div>
              ))}
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

function History({ results, onDelete }: { results: Outcome[]; onDelete: (game: Game) => Promise<void> }) {
  const { t } = useI18n();
  const [confirming, setConfirming] = useState<string | null>(null);
  const [showAll, setShowAll] = useState(false);
  const newestFirst = [...results].reverse();
  const visible = showAll ? newestFirst : newestFirst.slice(0, 8);
  return (
    <section className="area-history" aria-labelledby="history-title">
      <h2 id="history-title" className="section-title">
        {t.scores.historyTitle}
      </h2>
      <ol className="history">
        {visible.map((r) => (
          <li key={r.game.id} className="history-item">
            <div className="history-head">
              <span className="history-date">{formatDay(r.game.playedOn, t.locale)}</span>
              {confirming === r.game.id ? (
                <span className="confirm">
                  {t.scores.confirmDelete}
                  <button
                    type="button"
                    className="link danger"
                    onClick={() => {
                      setConfirming(null);
                      void onDelete(r.game);
                    }}
                  >
                    {t.scores.yesDelete}
                  </button>
                  <button type="button" className="link" onClick={() => setConfirming(null)}>
                    {t.scores.cancel}
                  </button>
                </span>
              ) : (
                <button type="button" className="link" onClick={() => setConfirming(r.game.id)}>
                  {t.scores.delete}
                </button>
              )}
            </div>
            <p className="history-scores">
              {r.ranked.map((x, i) => (
                <span
                  key={x.player.id}
                  className={r.winners.some((w) => w.id === x.player.id) ? "is-winner" : ""}
                  style={{ "--player": x.player.color } as CSSProperties}
                >
                  {i > 0 && <span className="sep"> – </span>}
                  <span className="dot" aria-hidden="true" />
                  {x.player.name} {x.gold}
                </span>
              ))}
              {r.margin > 0 && <span className="margin"> (+{r.margin})</span>}
            </p>
            {r.game.cards && (
              <p className="history-cards" lang="en">
                {r.game.cards.join(" · ")}
              </p>
            )}
          </li>
        ))}
      </ol>
      {newestFirst.length > visible.length && (
        <button type="button" className="pill" onClick={() => setShowAll(true)}>
          {t.scores.showAll(newestFirst.length)}
        </button>
      )}
    </section>
  );
}

function Players({ board, mutate }: { board: Scoreboard; mutate: Mutate }) {
  const { t } = useI18n();
  const [editing, setEditing] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [error, setError] = useState("");

  const save = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    try {
      await mutate(editing === "new" ? { type: "addPlayer", name } : { type: "renamePlayer", id: editing!, name });
      setEditing(null);
      setName("");
    } catch (err) {
      setError(errorText(t, errorCodeOf(err)));
    }
  };

  const startEditing = (id: string, current: string) => {
    setEditing(id);
    setName(current);
    setError("");
  };

  return (
    <section className="area-players" aria-labelledby="players-title">
      <h2 id="players-title" className="section-title">
        {t.scores.playersTitle}
      </h2>
      <ul className="players">
        {board.players.map((p) =>
          editing === p.id ? (
            <li key={p.id}>
              <PlayerNameForm value={name} onChange={setName} onSubmit={save} onCancel={() => setEditing(null)} />
            </li>
          ) : (
            <li key={p.id} style={{ "--player": p.color } as CSSProperties}>
              <span className="dot" aria-hidden="true" />
              <span className="player-name">{p.name}</span>
              <button type="button" className="link" onClick={() => startEditing(p.id, p.name)}>
                {t.scores.rename}
              </button>
            </li>
          ),
        )}
        {editing === "new" && (
          <li>
            <PlayerNameForm value={name} onChange={setName} onSubmit={save} onCancel={() => setEditing(null)} />
          </li>
        )}
      </ul>
      {error && (
        <p className="notice" role="alert">
          {error}
        </p>
      )}
      {editing === null && board.players.length < MAX_PLAYERS && (
        <button type="button" className="pill" onClick={() => startEditing("new", "")}>
          {t.scores.addPlayer}
        </button>
      )}
    </section>
  );
}

function PlayerNameForm({
  value,
  onChange,
  onSubmit,
  onCancel,
}: {
  value: string;
  onChange: (v: string) => void;
  onSubmit: (e: FormEvent) => void;
  onCancel: () => void;
}) {
  const { t } = useI18n();
  return (
    <form className="name-form" onSubmit={onSubmit}>
      <label className="visually-hidden" htmlFor="player-name">
        {t.scores.playerName}
      </label>
      <input
        id="player-name"
        autoFocus
        maxLength={24}
        autoCapitalize="words"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
      <button type="submit" className="pill" disabled={!value.trim()}>
        {t.scores.save}
      </button>
      <button type="button" className="link" onClick={onCancel}>
        {t.scores.cancel}
      </button>
    </form>
  );
}
