// Text for sharing the scoreboard to WhatsApp (or any messaging app).
import type { Messages } from "./i18n";
import type { Scoreboard } from "./scoreboard";
import { formatDay, outcomes, playerStats } from "./stats";

export function scoreboardShareText(board: Scoreboard, t: Messages, url: string): string {
  const sh = t.share;
  const results = outcomes(board);
  const stats = playerStats(board, results).filter((s) => s.played > 0);
  const lines = [`🏰 ${sh.title}`];

  if (stats.length) {
    const wins = [...stats].sort((a, b) => b.wins - a.wins).map((s) => `${s.player.name} ${s.wins}`);
    lines.push(`🏆 ${sh.wins}: ${wins.join(" · ")} (${t.scores.games(results.length)})`);
  }

  const last = results.at(-1);
  if (last) {
    const score = last.ranked.map((x) => `${x.player.name} ${x.gold}`).join(" – ");
    lines.push(`🎲 ${sh.lastGame(formatDay(last.game.playedOn, t.locale))}: ${score}`);

    if (last.winners.length === 1) {
      const champ = last.winners[0];
      let streak = 0;
      for (let i = results.length - 1; i >= 0; i--) {
        const r = results[i];
        if (r.winners.length === 1 && r.winners[0].id === champ.id) streak++;
        else break;
      }
      if (streak >= 2) lines.push(`🔥 ${sh.streak(champ.name, streak)}`);
    }
  }

  const decided = results.filter((r) => r.winners.length === 1);
  if (decided.length) {
    const record = decided.reduce((a, b) => (b.margin > a.margin ? b : a));
    lines.push(
      `📏 ${sh.record}: ${record.ranked[0].player.name} ${record.ranked[0].gold} – ${record.ranked[1].player.name} ${record.ranked[1].gold} (+${record.margin})`,
    );
  }

  lines.push(`👉 ${url}`);
  return lines.join("\n");
}

export const whatsappLink = (text: string) => `https://wa.me/?text=${encodeURIComponent(text)}`;
