"use client";

import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { errorText } from "@/lib/i18n";
import { MAX_PLAYERS, type Game, type GroupMutation, type Scoreboard } from "@/lib/scoreboard";
import { errorCodeOf, fetchScoreboard, sendMutation } from "@/lib/scoresClient";
import { scoreboardShareText, whatsappLink } from "@/lib/share";
import {
  activePlayers,
  comparisons,
  formatDay,
  outcomes,
  playerStats,
  sharedFacts,
  type Comparison,
  type Fact,
  type Outcome,
  type PlayerStats,
} from "@/lib/stats";
import { AddGameForm } from "./AddGame";
import { useI18n } from "./i18n";
import { ColorPicker, playerStyle } from "./players";
import { PlayerPicker } from "./Onboarding";
import { forgetGroup, inviteUrl, leaveGroup, selectGroup, useGroupId } from "./session";
import { SiteNav } from "./SiteNav";

type Toast = { text: string; undo?: Game; share?: string };
/** A change to the selected group (the group id is added automatically). */
type Change = GroupMutation extends infer M ? (M extends GroupMutation ? Omit<M, "groupId"> : never) : never;
type Mutate = (change: Change) => Promise<Scoreboard>;

export function ScoreTracker() {
  const { t } = useI18n();
  const groupId = useGroupId();
  const [board, setBoard] = useState<Scoreboard | null>(null);
  const [loadError, setLoadError] = useState("");
  const [toast, setToast] = useState<Toast | null>(null);

  const load = useCallback(() => {
    if (!groupId) return;
    fetchScoreboard(groupId).then(
      (next) => {
        setBoard(next);
        selectGroup(next); // keeps the player names in the top bar current
      },
      (err) => {
        // Deleted on another phone: go back to the player picker.
        if (errorCodeOf(err) === "group_not_found") forgetGroup(groupId);
        else setLoadError(errorCodeOf(err));
      },
    );
  }, [groupId]);

  useEffect(load, [load]);

  // Opening an invite link (/skor?davet=<group id>) joins that group on this phone.
  useEffect(() => {
    const invite = new URLSearchParams(window.location.search).get("davet");
    if (!invite) return;
    window.history.replaceState(null, "", "/skor");
    fetchScoreboard(invite).then(
      (joined) => {
        selectGroup(joined);
        setToast({ text: t.invite.joined(joined.players.map((p) => p.name).join(" · ")) });
      },
      () => setToast({ text: t.errors.invite_invalid }),
    );
    // Runs once per page load; the text language at that moment is fine.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), toast.undo ? 10000 : 6000);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const mutate = useCallback<Mutate>(
    async (change) => {
      const next = await sendMutation({ ...change, groupId: groupId! } as GroupMutation);
      setBoard(next);
      selectGroup(next);
      return next;
    },
    [groupId],
  );

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
    setToast({ text, share: whatsappLink(scoreboardShareText(after, t, inviteUrl(after.id))) });
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

      {groupId === null && <PlayerPicker />}

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

      {groupId && board?.id !== groupId && !loadError && <p className="loading">{t.scores.loading}</p>}

      {groupId && board && board.id === groupId && (
        <main className="score-main">
          <Leaderboard stats={stats} totalGames={results.length} />
          {results.length === 0 && <InviteBox board={board} />}
          {results.length > 0 && (
            <a
              className="share-btn area-share"
              href={whatsappLink(scoreboardShareText(board, t, inviteUrl(board.id)))}
              target="_blank"
              rel="noopener noreferrer"
            >
              <WhatsAppIcon /> {t.share.button}
            </a>
          )}
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
          {toast.share && (
            <a href={toast.share} target="_blank" rel="noopener noreferrer" onClick={() => setToast(null)}>
              WhatsApp
            </a>
          )}
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

/** Invite link for other phones: WhatsApp or copy. Anyone with the link can see and add scores. */
function InviteBox({ board }: { board: Scoreboard }) {
  const { t } = useI18n();
  const [copied, setCopied] = useState(false);
  const url = inviteUrl(board.id);
  const names = board.players.map((p) => p.name).join(" · ");
  return (
    <section className="invite-box area-invite" aria-labelledby={`invite-${board.id}`}>
      <h3 id={`invite-${board.id}`}>🔗 {t.invite.title}</h3>
      <p>{t.invite.hint}</p>
      <div className="invite-actions">
        <a
          className="share-btn"
          href={whatsappLink(t.invite.message(names, url))}
          target="_blank"
          rel="noopener noreferrer"
        >
          <WhatsAppIcon /> {t.invite.whatsapp}
        </a>
        <button
          type="button"
          className="pill"
          onClick={() =>
            navigator.clipboard.writeText(url).then(
              () => {
                setCopied(true);
                window.setTimeout(() => setCopied(false), 2500);
              },
              () => window.prompt(t.invite.copy, url),
            )
          }
        >
          {copied ? t.invite.copied : t.invite.copy}
        </button>
      </div>
    </section>
  );
}

function WhatsAppIcon() {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
      <path
        fill="currentColor"
        d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2m0 18.2c-1.5 0-3-.4-4.3-1.2l-.3-.2-3 .8.8-2.9-.2-.3A8.2 8.2 0 1 1 12 20.2m4.5-6.1c-.2-.1-1.5-.7-1.7-.8s-.4-.1-.6.1-.7.8-.8 1-.3.2-.5.1a6.7 6.7 0 0 1-3.3-2.9c-.3-.4.3-.4.7-1.4.1-.2 0-.3 0-.4l-.8-1.8c-.2-.5-.4-.4-.6-.4h-.5a1 1 0 0 0-.7.3 3 3 0 0 0-.9 2.2 5.2 5.2 0 0 0 1.1 2.7 11.8 11.8 0 0 0 4.5 4c1.7.7 2.3.8 3.2.6.5-.1 1.5-.6 1.7-1.2s.2-1.1.2-1.2-.2-.2-.5-.3"
      />
    </svg>
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
            style={playerStyle(s.player.color)}
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
              {s.played ? ` · ${t.scores.percent(Math.round(s.winRate * 100))}` : ""}
              {s.draws ? ` · ${t.scores.draws(s.draws)}` : ""}
            </span>
          </div>
        );
      })}
      {totalGames === 0 && <p className="empty">{t.scores.empty}</p>}
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
                  style={playerStyle(c.player.color)}
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
                  style={playerStyle(x.player.color)}
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
            <li key={p.id} className="player-row" style={playerStyle(p.color)}>
              <span className="dot" aria-hidden="true" />
              <span className="player-name">{p.name}</span>
              <button type="button" className="link" onClick={() => startEditing(p.id, p.name)}>
                {t.scores.rename}
              </button>
              <ColorPicker
                value={p.color}
                label={t.scores.colorOf(p.name)}
                onChange={(color) =>
                  void mutate({ type: "recolorPlayer", id: p.id, color }).catch((err) =>
                    setError(errorText(t, errorCodeOf(err))),
                  )
                }
              />
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
      <InviteBox board={board} />
      <div className="players-actions">
        {editing === null && board.players.length < MAX_PLAYERS && (
          <button type="button" className="pill" onClick={() => startEditing("new", "")}>
            {t.scores.addPlayer}
          </button>
        )}
        <button type="button" className="pill" onClick={leaveGroup}>
          👥 {t.scores.otherPlayers}
        </button>
      </div>
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
