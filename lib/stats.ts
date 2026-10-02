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
  avgGold: number;
  bestGold: number;
  totalGold: number;
  longestStreak: number;
};

export type Fact = { icon: string; title: string; text: string };

const WEEKDAYS = ["Pazar", "Pazartesi", "Salı", "Çarşamba", "Perşembe", "Cuma", "Cumartesi"];
const BIG_WIN = 30;

export function parseDay(day: string) {
  const [y, m, d] = day.split("-").map(Number);
  return new Date(y, m - 1, d);
}

export function formatDay(day: string) {
  return new Intl.DateTimeFormat("tr-TR", { day: "numeric", month: "long", year: "numeric" }).format(parseDay(day));
}

export function todayLocal() {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

const fmt = (n: number) => new Intl.NumberFormat("tr-TR", { maximumFractionDigits: 1 }).format(n);
const names = (players: Player[]) => players.map((p) => p.name).join(" ve ");

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

export function playerStats(board: Scoreboard, results: Outcome[]): PlayerStats[] {
  return board.players.map((player) => {
    let played = 0,
      wins = 0,
      draws = 0,
      totalGold = 0,
      bestGold = 0,
      streak = 0,
      longestStreak = 0;
    for (const r of results) {
      const mine = r.ranked.find((x) => x.player.id === player.id);
      if (!mine) continue;
      played++;
      totalGold += mine.gold;
      bestGold = Math.max(bestGold, mine.gold);
      const won = r.winners.some((w) => w.id === player.id);
      if (won && r.winners.length === 1) {
        wins++;
        streak++;
        longestStreak = Math.max(longestStreak, streak);
      } else {
        if (won) draws++;
        streak = 0;
      }
    }
    return {
      player,
      played,
      wins,
      draws,
      winRate: played ? wins / played : 0,
      avgGold: played ? totalGold / played : 0,
      bestGold,
      totalGold,
      longestStreak,
    };
  });
}

function dayDiff(a: string, b: string) {
  return Math.round((parseDay(b).getTime() - parseDay(a).getTime()) / 86_400_000);
}

export function funFacts(board: Scoreboard, results: Outcome[], stats: PlayerStats[]): Fact[] {
  const facts: Fact[] = [];
  if (results.length === 0) return facts;
  const decided = results.filter((r) => r.winners.length === 1);
  const vs = (r: Outcome) => `${r.ranked[0].player.name} ${r.ranked[0].gold} – ${r.ranked[1].player.name} ${r.ranked[1].gold}`;

  // Current winning streak.
  const last = results.at(-1)!;
  if (last.winners.length === 1) {
    const champ = last.winners[0];
    let n = 0;
    for (let i = results.length - 1; i >= 0; i--) {
      const r = results[i];
      if (r.winners.length === 1 && r.winners[0].id === champ.id) n++;
      else break;
    }
    if (n >= 2) facts.push({ icon: "🔥", title: "Seri devam ediyor", text: `${champ.name} son ${n} oyunu üst üste kazandı.` });
  }

  if (decided.length) {
    const record = decided.reduce((a, b) => (b.margin > a.margin ? b : a));
    facts.push({
      icon: "🏆",
      title: "Rekor fark",
      text: `${vs(record)} — ${record.margin} altın fark (${formatDay(record.game.playedOn)}).`,
    });
  }

  if (decided.length >= 2) {
    const closest = decided.reduce((a, b) => (b.margin < a.margin ? b : a));
    facts.push({
      icon: "⚖️",
      title: "En çekişmeli oyun",
      text: `${closest.winners[0].name} sadece ${closest.margin} altın farkla kazandı (${vs(closest)}, ${formatDay(closest.game.playedOn)}).`,
    });
  }

  const allScores = results.flatMap((r) => r.ranked.map((x) => ({ ...x, day: r.game.playedOn })));
  const high = allScores.reduce((a, b) => (b.gold > a.gold ? b : a));
  facts.push({ icon: "💰", title: "En yüksek skor", text: `${high.player.name}, ${high.gold} altın (${formatDay(high.day)}).` });
  if (results.length >= 3) {
    const low = allScores.reduce((a, b) => (b.gold < a.gold ? b : a));
    facts.push({ icon: "🫣", title: "En düşük skor", text: `${low.player.name}, ${low.gold} altın (${formatDay(low.day)}). Herkesin kötü bir gecesi olur.` });
  }

  const streakKing = stats.reduce((a, b) => (b.longestStreak > a.longestStreak ? b : a));
  if (streakKing.longestStreak >= 3) {
    facts.push({ icon: "👑", title: "En uzun galibiyet serisi", text: `${streakKing.player.name}: üst üste ${streakKing.longestStreak} galibiyet.` });
  }

  // Consecutive game nights.
  const days = [...new Set(results.map((r) => r.game.playedOn))];
  let run = 1,
    bestRun = 1;
  for (let i = 1; i < days.length; i++) {
    run = dayDiff(days[i - 1], days[i]) === 1 ? run + 1 : 1;
    bestRun = Math.max(bestRun, run);
  }
  const currentRun = dayDiff(days.at(-1)!, todayLocal()) <= 1 ? run : 0;
  if (currentRun >= 2) {
    facts.push({ icon: "🌙", title: "Oyun gecesi serisi", text: `${currentRun} gecedir aralıksız oynuyorsunuz.${bestRun > currentRun ? ` Rekor: ${bestRun} gece.` : ""}` });
  } else if (bestRun >= 3) {
    facts.push({ icon: "🌙", title: "Oyun gecesi rekoru", text: `En uzun aralıksız seri: ${bestRun} gece.` });
  }

  const thisMonth = todayLocal().slice(0, 7);
  const monthResults = results.filter((r) => r.game.playedOn.startsWith(thisMonth));
  if (monthResults.length >= 2) {
    const counts = board.players
      .map((p) => ({ p, n: monthResults.filter((r) => r.winners.length === 1 && r.winners[0].id === p.id).length }))
      .filter((x) => monthResults.some((r) => r.ranked.some((y) => y.player.id === x.p.id)));
    facts.push({ icon: "📅", title: "Bu ay", text: counts.map((x) => `${x.p.name} ${x.n}`).join(", ") + ` galibiyet (${monthResults.length} oyun).` });
  }

  if (results.length >= 3) {
    const totals = stats.filter((s) => s.played).sort((a, b) => b.totalGold - a.totalGold);
    facts.push({ icon: "🪙", title: "Hazine", text: "Bugüne kadar toplanan altın: " + totals.map((s) => `${s.player.name} ${fmt(s.totalGold)}`).join(", ") + "." });
  }

  for (const s of stats) {
    const myWins = decided.filter((r) => r.winners[0].id === s.player.id);
    if (myWins.length >= 3) {
      const avg = myWins.reduce((sum, r) => sum + r.margin, 0) / myWins.length;
      facts.push({ icon: "📏", title: `${s.player.name} kazanınca`, text: `ortalama ${fmt(avg)} altın farkla kazanıyor.` });
    }
  }

  const crushes = board.players
    .map((p) => ({ p, n: decided.filter((r) => r.winners[0].id === p.id && r.margin >= BIG_WIN).length }))
    .filter((x) => x.n > 0);
  if (crushes.length) {
    facts.push({ icon: "💥", title: `${BIG_WIN}+ altın farkla ezici galibiyet`, text: crushes.map((x) => `${x.p.name} ${x.n} kez`).join(", ") + "." });
  }

  // Revenge: win rate in the very next game after a loss.
  for (const s of stats) {
    let chances = 0,
      revenges = 0;
    for (let i = 0; i < results.length - 1; i++) {
      const lost = results[i].ranked.some((x) => x.player.id === s.player.id) && !results[i].winners.some((w) => w.id === s.player.id);
      const next = results[i + 1];
      if (!lost || !next.ranked.some((x) => x.player.id === s.player.id)) continue;
      chances++;
      if (next.winners.length === 1 && next.winners[0].id === s.player.id) revenges++;
    }
    if (chances >= 3) {
      facts.push({ icon: "⚔️", title: `${s.player.name} rövanşta`, text: `Kaybettiği oyunun ardından gelen ${chances} oyunda ${revenges} galibiyet (%${Math.round((revenges / chances) * 100)}).` });
    }
  }

  // Lucky Kingdom Builder card per player.
  for (const s of stats) {
    let best: { card: string; wins: number; games: number } | null = null;
    const cards = new Set(results.flatMap((r) => r.game.cards ?? []));
    for (const card of cards) {
      const withCard = results.filter((r) => r.game.cards?.includes(card) && r.ranked.some((x) => x.player.id === s.player.id));
      const wins = withCard.filter((r) => r.winners.length === 1 && r.winners[0].id === s.player.id).length;
      if (withCard.length >= 2 && wins >= 2 && (!best || wins / withCard.length > best.wins / best.games)) {
        best = { card, wins, games: withCard.length };
      }
    }
    if (best) {
      facts.push({ icon: "🃏", title: `Şanslı kart: ${s.player.name}`, text: `${best.card} masadayken ${best.games} oyunda ${best.wins} galibiyet.` });
    }
  }

  if (results.length >= 5) {
    const counts = new Array(7).fill(0);
    for (const day of days) counts[parseDay(day).getDay()]++;
    const max = Math.max(...counts);
    const favorites = WEEKDAYS.filter((_, i) => counts[i] === max);
    facts.push({ icon: "🗓️", title: "Favori oyun günü", text: `En çok ${favorites.join(" ve ")} günleri oynuyorsunuz.` });
  }

  const draws = results.filter((r) => r.winners.length > 1);
  if (draws.length) {
    const d = draws.at(-1)!;
    facts.push({ icon: "🤝", title: "Beraberlik", text: `${draws.length} oyun berabere bitti. Sonuncusu: ${names(d.winners)}, ${d.ranked[0].gold} altın.` });
  }

  return facts;
}
