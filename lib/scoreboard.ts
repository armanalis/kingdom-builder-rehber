// Scoreboard data model and the pure mutations applied to it (shared by server and client).

export type Player = { id: string; name: string; color: string };

export type Score = { playerId: string; gold: number };

export type Game = {
  id: string;
  /** Local calendar day the game was played, YYYY-MM-DD. */
  playedOn: string;
  /** ISO timestamp, orders games played on the same day. */
  createdAt: string;
  scores: Score[];
  /** The 3 Kingdom Builder cards in play (optional). */
  cards?: string[];
};

export type Scoreboard = { version: 1; players: Player[]; games: Game[] };

export type Mutation =
  | { type: "addGame"; game: Partial<Game> }
  | { type: "deleteGame"; id: string }
  | { type: "addPlayer"; name: string }
  | { type: "renamePlayer"; id: string; name: string };

export const PLAYER_COLORS = ["#d9822b", "#3a6fb0", "#6b6f78", "#2b2118", "#9b4f96", "#3f8f7a"];
export const MAX_PLAYERS = 6;
export const MAX_GOLD = 400;

export const KB_CARD_NAMES = [
  "Farmers",
  "Lords",
  "Knights",
  "Discoverers",
  "Merchants",
  "Citizens",
  "Hermits",
  "Fishermen",
  "Miners",
  "Workers",
];

export class ScoreboardError extends Error {}

export function emptyScoreboard(): Scoreboard {
  return {
    version: 1,
    players: [
      { id: "anne", name: "Anne", color: PLAYER_COLORS[0] },
      { id: "baba", name: "Baba", color: PLAYER_COLORS[1] },
    ],
    games: [],
  };
}

export function sortGames(games: Game[]): Game[] {
  return [...games].sort(
    (a, b) => a.playedOn.localeCompare(b.playedOn) || a.createdAt.localeCompare(b.createdAt),
  );
}

function cleanName(name: unknown): string {
  const value = typeof name === "string" ? name.trim().replace(/\s+/g, " ") : "";
  if (!value || value.length > 24) throw new ScoreboardError("İsim 1–24 karakter olmalı.");
  return value;
}

function newId() {
  return crypto.randomUUID();
}

export function applyMutation(board: Scoreboard, m: Mutation): Scoreboard {
  switch (m.type) {
    case "addGame": {
      const g = m.game ?? {};
      const id = typeof g.id === "string" && g.id ? g.id : newId();
      if (board.games.some((existing) => existing.id === id)) return board; // idempotent retry/undo

      if (typeof g.playedOn !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(g.playedOn)) {
        throw new ScoreboardError("Tarih geçersiz.");
      }
      const playerIds = new Set(board.players.map((p) => p.id));
      const scores = Array.isArray(g.scores) ? g.scores : [];
      const seen = new Set<string>();
      for (const s of scores) {
        if (!s || !playerIds.has(s.playerId) || seen.has(s.playerId)) {
          throw new ScoreboardError("Oyuncu listesi geçersiz.");
        }
        if (!Number.isInteger(s.gold) || s.gold < 0 || s.gold > MAX_GOLD) {
          throw new ScoreboardError(`Altın 0 ile ${MAX_GOLD} arasında tam sayı olmalı.`);
        }
        seen.add(s.playerId);
      }
      if (scores.length < 2) throw new ScoreboardError("En az 2 oyuncunun skoru girilmeli.");

      const cards = Array.isArray(g.cards)
        ? [...new Set(g.cards.filter((c) => KB_CARD_NAMES.includes(c)))].slice(0, 3)
        : [];
      const game: Game = {
        id,
        playedOn: g.playedOn,
        createdAt: typeof g.createdAt === "string" ? g.createdAt : new Date().toISOString(),
        scores: scores.map((s) => ({ playerId: s.playerId, gold: s.gold })),
        ...(cards.length ? { cards } : {}),
      };
      return { ...board, games: sortGames([...board.games, game]) };
    }
    case "deleteGame":
      return { ...board, games: board.games.filter((g) => g.id !== m.id) };
    case "addPlayer": {
      if (board.players.length >= MAX_PLAYERS) {
        throw new ScoreboardError(`En fazla ${MAX_PLAYERS} oyuncu eklenebilir.`);
      }
      const name = cleanName(m.name);
      const color = PLAYER_COLORS.find((c) => !board.players.some((p) => p.color === c)) ?? PLAYER_COLORS[0];
      return { ...board, players: [...board.players, { id: newId(), name, color }] };
    }
    case "renamePlayer": {
      const name = cleanName(m.name);
      if (!board.players.some((p) => p.id === m.id)) throw new ScoreboardError("Oyuncu bulunamadı.");
      return { ...board, players: board.players.map((p) => (p.id === m.id ? { ...p, name } : p)) };
    }
    default:
      throw new ScoreboardError("Bilinmeyen işlem.");
  }
}
