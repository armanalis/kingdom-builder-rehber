"use client";

import { useCallback, useEffect, useMemo, useState, type CSSProperties, type FormEvent } from "react";
import {
  KB_CARD_NAMES,
  MAX_GOLD,
  MAX_PLAYERS,
  needsSetup,
  type Game,
  type Mutation,
  type Scoreboard,
} from "@/lib/scoreboard";
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
} from "@/lib/stats";
import { SiteNav } from "./SiteNav";

type Toast = { text: string; undo?: Game };

export function ScoreTracker() {
  const [board, setBoard] = useState<Scoreboard | null>(null);
  const [loadError, setLoadError] = useState("");
  const [toast, setToast] = useState<Toast | null>(null);

  const load = useCallback(() => {
    fetch("/api/scores", { cache: "no-store" })
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) throw new Error(data.error);
        setBoard(data as Scoreboard);
      })
      .catch(() => setLoadError("Skorlar yüklenemedi. İnternet bağlantısını kontrol edip tekrar deneyin."));
  }, []);

  useEffect(load, [load]);

  useEffect(() => {
    if (!toast) return;
    const t = window.setTimeout(() => setToast(null), toast.undo ? 10000 : 6000);
    return () => window.clearTimeout(t);
  }, [toast]);

  const mutate = useCallback(async (mutation: Mutation): Promise<Scoreboard> => {
    const res = await fetch("/api/scores", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(mutation),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error ?? "Kaydedilemedi.");
    setBoard(data as Scoreboard);
    return data as Scoreboard;
  }, []);

  const results = useMemo(() => (board ? outcomes(board) : []), [board]);
  const stats = useMemo(() => (board ? playerStats(board, results) : []), [board, results]);
  const facts = useMemo(() => sharedFacts(results), [results]);
  const rows = useMemo(
    () => (board ? comparisons(activePlayers(board, stats), results) : []),
    [board, stats, results],
  );

  const onSaved = (before: Outcome[], after: Scoreboard, gameId: string) => {
    const all = outcomes(after);
    const r = all.find((o) => o.game.id === gameId);
    if (!r) return;
    const prevRecord = Math.max(0, ...before.filter((o) => o.winners.length === 1).map((o) => o.margin));
    const prevHigh = Math.max(0, ...before.flatMap((o) => o.ranked.map((x) => x.gold)));
    let text =
      r.winners.length > 1
        ? `Kaydedildi: ${r.winners.map((w) => w.name).join(" ve ")} berabere!`
        : `Kaydedildi: ${r.winners[0].name} kazandı, ${r.margin} altın farkla.`;
    if (before.length > 0 && r.winners.length === 1 && r.margin > prevRecord) text += " 🏆 Yeni rekor fark!";
    else if (before.length > 0 && r.ranked[0].gold > prevHigh) text += " 💰 Yeni en yüksek skor!";
    setToast({ text });
  };

  return (
    <div className="page">
      <SiteNav />
      <header className="hero hero-compact">
        <p className="eyebrow" lang="en">
          Kingdom Builder
        </p>
        <h1>Skor Tablosu</h1>
        <p className="lede">Her oyundan sonra altınları girin; kim önde, rekorlar ve tuhaf istatistikler burada.</p>
      </header>

      {loadError && (
        <div className="notice" role="alert">
          {loadError}{" "}
          <button
            type="button"
            className="pill"
            onClick={() => {
              setLoadError("");
              load();
            }}
          >
            Tekrar dene
          </button>
        </div>
      )}

      {!board && !loadError && <p className="loading">Skorlar yükleniyor…</p>}

      {board && needsSetup(board) && <SetupCard mutate={mutate} />}

      {board && !needsSetup(board) && (
        <main className="score-main">
          <Leaderboard stats={stats} totalGames={results.length} />
          <AddGameForm board={board} mutate={mutate} onSaved={(after, id) => onSaved(results, after, id)} />
          {results.length > 0 && <Stats facts={facts} rows={rows} />}
          {results.length > 0 && (
            <History
              results={results}
              onDelete={async (game) => {
                await mutate({ type: "deleteGame", id: game.id });
                setToast({ text: `${formatDay(game.playedOn)} oyunu silindi.`, undo: game });
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
                void mutate({ type: "addGame", game }).catch(() => setToast({ text: "Geri alınamadı." }));
              }}
            >
              Geri al
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function SetupCard({ mutate }: { mutate: (m: Mutation) => Promise<Scoreboard> }) {
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
      await mutate({ type: "setupPlayers", names });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Kaydedilemedi.");
      setSaving(false);
    }
  };

  return (
    <section className="panel setup" aria-labelledby="setup-title">
      <h2 id="setup-title" className="panel-title">
        Önce isimlerinizi yazın
      </h2>
      <p className="setup-lede">Skorlar ve istatistikler bu isimlerle tutulacak. Sonradan değiştirebilirsiniz.</p>
      <form onSubmit={onSubmit}>
        {names.map((value, i) => (
          <label key={i} className="setup-field" style={{ "--player": i === 0 ? "#d9822b" : "#3a6fb0" } as CSSProperties}>
            <span>
              <span className="dot" aria-hidden="true" /> {i + 1}. oyuncu
            </span>
            <input
              value={value}
              maxLength={24}
              autoComplete="off"
              placeholder={i === 0 ? "örn. Anne" : "örn. Baba"}
              onChange={(e) => setNames((prev) => prev.map((n, j) => (j === i ? e.target.value : n)))}
            />
          </label>
        ))}
        {error && (
          <p className="notice" role="alert">
            {error}
          </p>
        )}
        <button type="submit" className="send send-wide" disabled={!ready || saving}>
          {saving ? "Kaydediliyor…" : "Başla"}
        </button>
      </form>
    </section>
  );
}

function Stats({ facts, rows }: { facts: Fact[]; rows: Comparison[] }) {
  return (
    <section aria-labelledby="facts-title">
      <h2 id="facts-title" className="section-title">
        İlginç istatistikler
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
      <h3 className="subsection-title">Kim, hangi rekorda?</h3>
      <div className="compare">
        {rows.map((row) => (
          <article key={row.title} className="compare-row">
            <h4>
              <span aria-hidden="true">{row.icon}</span> {row.title}
            </h4>
            <div className="compare-cells" style={{ "--cols": row.cells.length } as CSSProperties}>
              {row.cells.map((c) => (
                <div
                  key={c.player.id}
                  className={`compare-cell${c.best ? " is-best" : ""}`}
                  style={{ "--player": c.player.color } as CSSProperties}
                >
                  <span className="compare-name">
                    <span className="dot" aria-hidden="true" /> {c.player.name}
                    {c.best && <span className="visually-hidden"> (önde)</span>}
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

function Leaderboard({ stats, totalGames }: { stats: ReturnType<typeof playerStats>; totalGames: number }) {
  const active = stats.filter((s) => s.played > 0 || stats.indexOf(s) < 2);
  const maxWins = Math.max(...active.map((s) => s.wins));
  const leaders = active.filter((s) => s.wins === maxWins && maxWins > 0);
  return (
    <section className="leaderboard" aria-label="Galibiyetler">
      {active.map((s) => {
        const leading = leaders.length === 1 && leaders[0] === s;
        return (
          <div
            key={s.player.id}
            className={`leader-card${leading ? " is-leading" : ""}`}
            style={{ "--player": s.player.color } as CSSProperties}
          >
            {leading && (
              <span className="crown" aria-label="Önde">
                👑
              </span>
            )}
            <span className="leader-name">{s.player.name}</span>
            <span className="leader-wins">{s.wins}</span>
            <span className="leader-label">galibiyet</span>
            <span className="leader-meta">
              {s.played} oyun{s.played ? ` · %${Math.round(s.winRate * 100)}` : ""}
              {s.draws ? ` · ${s.draws} beraberlik` : ""}
            </span>
          </div>
        );
      })}
      {totalGames === 0 && <p className="empty">Henüz oyun yok. Aşağıdan ilk oyunun skorunu ekleyin.</p>}
    </section>
  );
}

function AddGameForm({
  board,
  mutate,
  onSaved,
}: {
  board: Scoreboard;
  mutate: (m: Mutation) => Promise<Scoreboard>;
  onSaved: (after: Scoreboard, gameId: string) => void;
}) {
  const defaultPlayers = () => {
    const last = board.games.at(-1);
    return new Set(last ? last.scores.map((s) => s.playerId) : board.players.slice(0, 2).map((p) => p.id));
  };
  const [playing, setPlaying] = useState<Set<string>>(defaultPlayers);
  const [gold, setGold] = useState<Record<string, string>>({});
  const [day, setDay] = useState(todayLocal);
  const [cards, setCards] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const entries = board.players
    .filter((p) => playing.has(p.id))
    .map((p) => ({ player: p, value: gold[p.id] ?? "" }));
  const filled = entries.every((e) => /^\d+$/.test(e.value) && Number(e.value) <= MAX_GOLD);
  const ready = entries.length >= 2 && filled;

  const preview = (() => {
    if (!ready) return "";
    const ranked = [...entries].sort((a, b) => Number(b.value) - Number(a.value));
    const top = Number(ranked[0].value);
    const tied = ranked.filter((e) => Number(e.value) === top);
    if (tied.length > 1) return `Berabere: ${tied.map((e) => e.player.name).join(" ve ")}`;
    return `Kazanan: ${ranked[0].player.name} (+${top - Number(ranked[1].value)} altın)`;
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
      setError(err instanceof Error ? err.message : "Kaydedilemedi.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="panel" aria-labelledby="add-title">
      <h2 id="add-title" className="panel-title">
        Oyun ekle
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
                  {p.name}
                </label>
                {on && (
                  <label className="gold-input">
                    <span className="visually-hidden">{p.name} altın</span>
                    <input
                      type="number"
                      inputMode="numeric"
                      min={0}
                      max={MAX_GOLD}
                      placeholder="0"
                      value={gold[p.id] ?? ""}
                      onChange={(e) => setGold((g) => ({ ...g, [p.id]: e.target.value }))}
                    />
                    <span aria-hidden="true">altın</span>
                  </label>
                )}
              </div>
            );
          })}
        </div>

        <details className="more-options">
          <summary>Tarih ve kartlar (isteğe bağlı)</summary>
          <label className="date-row">
            Tarih
            <input type="date" value={day} max={todayLocal()} onChange={(e) => setDay(e.target.value || todayLocal())} />
          </label>
          <p className="cards-hint">Bu oyundaki 3 Kingdom Builder kartı (şanslı kart istatistiği için):</p>
          <div className="card-chips" lang="en">
            {KB_CARD_NAMES.map((c) => (
              <button
                key={c}
                type="button"
                className="chip"
                aria-pressed={cards.includes(c)}
                onClick={() => toggleCard(c)}
              >
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
          {saving ? "Kaydediliyor…" : "Kaydet"}
        </button>
      </form>
    </section>
  );
}

function History({ results, onDelete }: { results: Outcome[]; onDelete: (game: Game) => Promise<void> }) {
  const [confirming, setConfirming] = useState<string | null>(null);
  const [showAll, setShowAll] = useState(false);
  const newestFirst = [...results].reverse();
  const visible = showAll ? newestFirst : newestFirst.slice(0, 8);
  return (
    <section aria-labelledby="history-title">
      <h2 id="history-title" className="section-title">
        Geçmiş oyunlar
      </h2>
      <ol className="history">
        {visible.map((r) => (
          <li key={r.game.id} className="history-item">
            <div className="history-head">
              <span className="history-date">{formatDay(r.game.playedOn)}</span>
              {confirming === r.game.id ? (
                <span className="confirm">
                  Silinsin mi?
                  <button
                    type="button"
                    className="link danger"
                    onClick={() => {
                      setConfirming(null);
                      void onDelete(r.game);
                    }}
                  >
                    Evet, sil
                  </button>
                  <button type="button" className="link" onClick={() => setConfirming(null)}>
                    Vazgeç
                  </button>
                </span>
              ) : (
                <button type="button" className="link" onClick={() => setConfirming(r.game.id)}>
                  Sil
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
          Tümünü göster ({newestFirst.length})
        </button>
      )}
    </section>
  );
}

function Players({ board, mutate }: { board: Scoreboard; mutate: (m: Mutation) => Promise<Scoreboard> }) {
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
      setError(err instanceof Error ? err.message : "Kaydedilemedi.");
    }
  };

  return (
    <section aria-labelledby="players-title">
      <h2 id="players-title" className="section-title">
        Oyuncular
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
              <button
                type="button"
                className="link"
                onClick={() => {
                  setEditing(p.id);
                  setName(p.name);
                  setError("");
                }}
              >
                İsmi değiştir
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
        <button
          type="button"
          className="pill"
          onClick={() => {
            setEditing("new");
            setName("");
            setError("");
          }}
        >
          + Oyuncu ekle
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
  return (
    <form className="name-form" onSubmit={onSubmit}>
      <label className="visually-hidden" htmlFor="player-name">
        Oyuncu adı
      </label>
      <input id="player-name" autoFocus maxLength={24} value={value} onChange={(e) => onChange(e.target.value)} />
      <button type="submit" className="pill" disabled={!value.trim()}>
        Kaydet
      </button>
      <button type="button" className="link" onClick={onCancel}>
        Vazgeç
      </button>
    </form>
  );
}
