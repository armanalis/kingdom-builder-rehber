import type { Messages } from "./i18n";
import { sortGames, type Game, type Player, type Scoreboard } from "./scoreboard";

export type Outcome = {
  game: Game;
  ranked: { player: Player; gold: number }[];
  winners: Player[];
  /** Gap between the winner and the next best score; 0 for a shared win. */
  margin: number;
};

export type PlayerStats = {
  player: Player;
  played: number;
  wins: number;
  draws: number;
  winRate: number;
};

export type Fact = { icon: string; title: string; text: string };

/** One statistic shown side by side for every player. */
export type Comparison = {
  icon: string;
  title: string;
  cells: { player: Player; text: string; best: boolean }[];
};

const BIG_WIN = 30;
const NONE = "—";

export function parseDay(day: string) {
  const [y, m, d] = day.split("-").map(Number);
  return new Date(y, m - 1, d);
}

export function formatDay(day: string, locale: string) {
  return new Intl.DateTimeFormat(locale, { day: "numeric", month: "long", year: "numeric" }).format(parseDay(day));
}

const shortDay = (day: string, locale: string) =>
  new Intl.DateTimeFormat(locale, { day: "numeric", month: "short" }).format(parseDay(day));

export function todayLocal() {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

const fmt = (n: number, locale: string) => new Intl.NumberFormat(locale, { maximumFractionDigits: 1 }).format(n);

function dayDiff(a: string, b: string) {
  return Math.round((parseDay(b).getTime() - parseDay(a).getTime()) / 86_400_000);
}

export function outcomes(board: Scoreboard): Outcome[] {
  const byId = new Map(board.players.map((p) => [p.id, p]));
  return sortGames(board.games).flatMap((game) => {
    const ranked = game.scores
      .flatMap((s) => {
        const player = byId.get(s.playerId);
        return player ? [{ player, gold: s.gold }] : [];
      })
      .sort((a, b) => b.gold - a.gold);
    if (ranked.length < 2) return [];
    const top = ranked[0].gold;
    const winners = ranked.filter((r) => r.gold === top).map((r) => r.player);
    const next = ranked.find((r) => r.gold < top);
    const margin = winners.length > 1 || !next ? 0 : top - next.gold;
    return [{ game, ranked, winners, margin }];
  });
}

const soleWinner = (r: Outcome, p: Player) => r.winners.length === 1 && r.winners[0].id === p.id;
const playedIn = (r: Outcome, p: Player) => r.ranked.some((x) => x.player.id === p.id);
const goldOf = (r: Outcome, p: Player) => r.ranked.find((x) => x.player.id === p.id)!.gold;

export function playerStats(board: Scoreboard, results: Outcome[]): PlayerStats[] {
  return board.players.map((player) => {
    const mine = results.filter((r) => playedIn(r, player));
    const wins = mine.filter((r) => soleWinner(r, player)).length;
    const draws = mine.filter((r) => r.winners.length > 1 && r.winners.some((w) => w.id === player.id)).length;
    return { player, played: mine.length, wins, draws, winRate: mine.length ? wins / mine.length : 0 };
  });
}

/** Players shown in comparisons: everyone who has played, at least the first two. */
export function activePlayers(board: Scoreboard, stats: PlayerStats[]) {
  return stats.filter((s, i) => s.played > 0 || i < 2).map((s) => s.player);
}

/** Highlights about the whole game history (not tied to one player). */
export function sharedFacts(results: Outcome[], t: Messages): Fact[] {
  const s = t.stats;
  const day = (d: string) => formatDay(d, t.locale);
  const facts: Fact[] = [];
  if (results.length === 0) return facts;
  const decided = results.filter((r) => r.winners.length === 1);
  const vs = (r: Outcome) =>
    `${r.ranked[0].player.name} ${r.ranked[0].gold} – ${r.ranked[1].player.name} ${r.ranked[1].gold}`;

  const last = results.at(-1)!;
  if (last.winners.length === 1) {
    const champ = last.winners[0];
    let n = 0;
    for (let i = results.length - 1; i >= 0 && soleWinner(results[i], champ); i--) n++;
    if (n >= 2) facts.push({ icon: "🔥", title: s.streakNowTitle, text: s.streakNow(champ.name, n) });
  }

  if (decided.length) {
    const record = decided.reduce((a, b) => (b.margin > a.margin ? b : a));
    facts.push({ icon: "🏆", title: s.recordTitle, text: s.record(vs(record), record.margin, day(record.game.playedOn)) });
  }
  if (decided.length >= 2) {
    const closest = decided.reduce((a, b) => (b.margin < a.margin ? b : a));
    facts.push({ icon: "⚖️", title: s.closestTitle, text: s.closest(vs(closest), closest.margin, day(closest.game.playedOn)) });
  }

  const days = [...new Set(results.map((r) => r.game.playedOn))];
  let run = 1;
  let bestRun = 1;
  for (let i = 1; i < days.length; i++) {
    run = dayDiff(days[i - 1], days[i]) === 1 ? run + 1 : 1;
    bestRun = Math.max(bestRun, run);
  }
  const currentRun = dayDiff(days.at(-1)!, todayLocal()) <= 1 ? run : 0;
  if (currentRun >= 2) {
    facts.push({ icon: "🌙", title: s.nightRunTitle, text: s.nightRun(currentRun, bestRun) });
  } else if (bestRun >= 3) {
    facts.push({ icon: "🌙", title: s.nightRecordTitle, text: s.nightRecord(bestRun) });
  }

  if (results.length >= 5) {
    const counts = new Array(7).fill(0);
    for (const day of days) counts[parseDay(day).getDay()]++;
    const max = Math.max(...counts);
    const favorites = s.weekdays.filter((_, i) => counts[i] === max);
    facts.push({ icon: "🗓️", title: s.favDayTitle, text: s.favDay(favorites.join(` ${t.and} `)) });
  }

  const draws = results.filter((r) => r.winners.length > 1);
  if (draws.length) {
    const d = draws.at(-1)!;
    facts.push({ icon: "🤝", title: s.drawsTitle, text: s.draws(draws.length, d.ranked[0].gold, day(d.game.playedOn)) });
  }

  return facts;
}

type Cell = { text: string; value?: number };

/** Per-player statistics, shown side by side so every player gets their own number. */
export function comparisons(players: Player[], results: Outcome[], t: Messages): Comparison[] {
  if (results.length === 0) return [];
  const s = t.stats;
  const short = (d: string) => shortDay(d, t.locale);
  const num = (n: number) => fmt(n, t.locale);
  const thisMonth = todayLocal().slice(0, 7);

  const row = (
    icon: string,
    title: string,
    cell: (p: Player, mine: Outcome[], wins: Outcome[]) => Cell,
    better: "high" | "low" | null = "high",
  ): Comparison => {
    const raw = players.map((p) => {
      const mine = results.filter((r) => playedIn(r, p));
      return { player: p, ...cell(p, mine, mine.filter((r) => soleWinner(r, p))) };
    });
    const values = raw.flatMap((c) => (c.value === undefined ? [] : [c.value]));
    const target = better === "high" ? Math.max(...values) : Math.min(...values);
    // Highlight a single clear leader only.
    const leaders = better && values.length > 1 ? raw.filter((c) => c.value === target) : [];
    return {
      icon,
      title,
      cells: raw.map((c) => ({ player: c.player, text: c.text, best: leaders.length === 1 && leaders[0] === c })),
    };
  };

  const streaks = (p: Player, mine: Outcome[], won: (r: Outcome) => boolean) => {
    let cur = 0;
    let best = 0;
    for (const r of mine) {
      cur = won(r) ? cur + 1 : 0;
      best = Math.max(best, cur);
    }
    return { best, current: cur };
  };

  const scoreLine = (r: Outcome, p: Player) => {
    const opponent = r.ranked.find((x) => x.player.id !== p.id)!;
    return `${goldOf(r, p)}–${opponent.gold}`;
  };

  return [
    row("👑", s.longestStreak, (p, mine) => {
      const { best } = streaks(p, mine, (r) => soleWinner(r, p));
      return { text: best ? s.matches(best) : NONE, value: best };
    }),
    row("🔥", s.currentStreak, (p, mine) => {
      const { current } = streaks(p, mine, (r) => soleWinner(r, p));
      return { text: current ? s.matches(current) : NONE, value: current };
    }),
    row("🏆", s.biggestWin, (p, _mine, wins) => {
      if (!wins.length) return { text: NONE };
      const r = wins.reduce((a, b) => (b.margin > a.margin ? b : a));
      return { text: `+${r.margin} (${scoreLine(r, p)}, ${short(r.game.playedOn)})`, value: r.margin };
    }),
    row(
      "🤏",
      s.closestWin,
      (p, _mine, wins) => {
        if (!wins.length) return { text: NONE };
        const r = wins.reduce((a, b) => (b.margin < a.margin ? b : a));
        return { text: `+${r.margin} (${scoreLine(r, p)}, ${short(r.game.playedOn)})`, value: r.margin };
      },
      null,
    ),
    row("📏", s.avgWinMargin, (_p, _mine, wins) => {
      if (!wins.length) return { text: NONE };
      const avg = wins.reduce((sum, r) => sum + r.margin, 0) / wins.length;
      return { text: `+${s.goldAmount(num(avg))}`, value: avg };
    }),
    row("💥", s.crushes(BIG_WIN), (_p, _mine, wins) => {
      const n = wins.filter((r) => r.margin >= BIG_WIN).length;
      return { text: s.times(n), value: n };
    }),
    row("💰", s.highScore, (p, mine) => {
      if (!mine.length) return { text: NONE };
      const r = mine.reduce((a, b) => (goldOf(b, p) > goldOf(a, p) ? b : a));
      return { text: `${s.goldAmount(String(goldOf(r, p)))} (${short(r.game.playedOn)})`, value: goldOf(r, p) };
    }),
    row(
      "🫣",
      s.lowScore,
      (p, mine) => {
        if (!mine.length) return { text: NONE };
        const r = mine.reduce((a, b) => (goldOf(b, p) < goldOf(a, p) ? b : a));
        return { text: `${s.goldAmount(String(goldOf(r, p)))} (${short(r.game.playedOn)})`, value: goldOf(r, p) };
      },
      null,
    ),
    row("📊", s.avgScore, (p, mine) => {
      if (!mine.length) return { text: NONE };
      const avg = mine.reduce((sum, r) => sum + goldOf(r, p), 0) / mine.length;
      return { text: s.goldAmount(num(avg)), value: avg };
    }),
    row("🪙", s.totalGold, (p, mine) => {
      const total = mine.reduce((sum, r) => sum + goldOf(r, p), 0);
      return { text: num(total), value: total };
    }),
    row(
      "🌧️",
      s.longestLosing,
      (p, mine) => {
        const { best } = streaks(p, mine, (r) => !r.winners.some((w) => w.id === p.id));
        return { text: best ? s.matches(best) : NONE, value: best };
      },
      null,
    ),
    row("⚔️", s.revenge, (p) => {
      let chances = 0;
      let revenges = 0;
      for (let i = 0; i < results.length - 1; i++) {
        const lost = playedIn(results[i], p) && !results[i].winners.some((w) => w.id === p.id);
        if (!lost || !playedIn(results[i + 1], p)) continue;
        chances++;
        if (soleWinner(results[i + 1], p)) revenges++;
      }
      if (!chances) return { text: NONE };
      const rate = revenges / chances;
      return { text: s.revengeText(chances, revenges, Math.round(rate * 100)), value: rate };
    }),
    row(
      "🃏",
      s.luckyCard,
      (p, mine) => {
        let best: { card: string; wins: number; games: number } | null = null;
        for (const card of new Set(mine.flatMap((r) => r.game.cards ?? []))) {
          const withCard = mine.filter((r) => r.game.cards?.includes(card));
          const wins = withCard.filter((r) => soleWinner(r, p)).length;
          if (wins >= 1 && (!best || wins / withCard.length > best.wins / best.games || (wins / withCard.length === best.wins / best.games && wins > best.wins))) {
            best = { card, wins, games: withCard.length };
          }
        }
        return { text: best ? s.luckyText(best.card, best.games, best.wins) : NONE };
      },
      null,
    ),
    row("📅", s.monthWins, (p, mine) => {
      const n = mine.filter((r) => r.game.playedOn.startsWith(thisMonth) && soleWinner(r, p)).length;
      return { text: `${n}`, value: n };
    }),
  ];
}
