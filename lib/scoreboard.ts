import type { ErrorCode } from "./i18n";

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

export type Scoreboard = {
  version: 1;
  players: Player[];
  games: Game[];
  /** True once the two players have entered their own names. */
  setupDone?: boolean;
};

export type Mutation =
  | { type: "addGame"; game: Partial<Game> }
  | { type: "deleteGame"; id: string }
  | { type: "setupPlayers"; names: string[] }
  | { type: "addPlayer"; name: string }
  | { type: "renamePlayer"; id: string; name: string };

// Settlement colors: orange, blue, black, white (shown grey), purple.
export const PLAYER_COLORS = ["#d9822b", "#3a6fb0", "#2b2118", "#8b9097", "#9b4f96"];
export const MIN_PLAYERS = 2;
export const MAX_PLAYERS = 5;
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

/** Validation failure; `message` is an i18n error code. */
export class ScoreboardError extends Error {
  constructor(public code: ErrorCode) {
    super(code);
  }
}

export function emptyScoreboard(): Scoreboard {
  return {
    version: 1,
    players: [
      { id: "anne", name: "1. oyuncu", color: PLAYER_COLORS[0] },
      { id: "baba", name: "2. oyuncu", color: PLAYER_COLORS[1] },
    ],
    games: [],
  };
}

export function needsSetup(board: Scoreboard) {
  return !board.setupDone && board.games.length === 0;
}

export function sortGames(games: Game[]): Game[] {
  return [...games].sort(
    (a, b) => a.playedOn.localeCompare(b.playedOn) || a.createdAt.localeCompare(b.createdAt),
  );
}

function cleanName(name: unknown): string {
  const value = typeof name === "string" ? name.trim().replace(/\s+/g, " ") : "";
  if (!value || value.length > 24) throw new ScoreboardError("name_length");
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
        throw new ScoreboardError("invalid_date");
      }
      const playerIds = new Set(board.players.map((p) => p.id));
      const scores = Array.isArray(g.scores) ? g.scores : [];
      const seen = new Set<string>();
      for (const s of scores) {
        if (!s || !playerIds.has(s.playerId) || seen.has(s.playerId)) {
          throw new ScoreboardError("invalid_players");
        }
        if (!Number.isInteger(s.gold) || s.gold < 0 || s.gold > MAX_GOLD) {
          throw new ScoreboardError("gold_range");
        }
        seen.add(s.playerId);
      }
      if (scores.length < 2) throw new ScoreboardError("min_players");

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
    case "setupPlayers": {
      if (!needsSetup(board)) return board; // another device finished setup first
      const names = Array.isArray(m.names) ? m.names.map(cleanName) : [];
      if (names.length < MIN_PLAYERS || names.length > MAX_PLAYERS) throw new ScoreboardError("names_count");
      if (new Set(names.map((n) => n.toLocaleLowerCase("tr"))).size !== names.length) {
        throw new ScoreboardError("names_distinct");
      }
      const players = names.map((name, i) => ({
        id: board.players[i]?.id ?? newId(),
        name,
        color: PLAYER_COLORS[i],
      }));
      return { ...board, players, setupDone: true };
    }
    case "deleteGame":
      return { ...board, games: board.games.filter((g) => g.id !== m.id) };
    case "addPlayer": {
      if (board.players.length >= MAX_PLAYERS) {
        throw new ScoreboardError("max_players");
      }
      const name = cleanName(m.name);
      if (board.players.some((p) => p.name.toLocaleLowerCase("tr") === name.toLocaleLowerCase("tr"))) {
        throw new ScoreboardError("names_distinct");
      }
      const color = PLAYER_COLORS.find((c) => !board.players.some((p) => p.color === c)) ?? PLAYER_COLORS[0];
      return { ...board, players: [...board.players, { id: newId(), name, color }] };
    }
    case "renamePlayer": {
      const name = cleanName(m.name);
      if (!board.players.some((p) => p.id === m.id)) throw new ScoreboardError("player_not_found");
      if (board.players.some((p) => p.id !== m.id && p.name.toLocaleLowerCase("tr") === name.toLocaleLowerCase("tr"))) {
        throw new ScoreboardError("names_distinct");
      }
      return { ...board, players: board.players.map((p) => (p.id === m.id ? { ...p, name } : p)) };
    }
    default:
      throw new ScoreboardError("generic");
  }
}
