import type { ErrorCode } from "./i18n";

// Scoreboard data model and the pure mutations applied to it (shared by server and client).
// All data lives in one store with several player groups (e.g. "Mom & Dad", "Friends");
// every device chooses which group it plays with.

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

/** One group of players and its game history. */
export type Scoreboard = { id: string; createdAt: string; players: Player[]; games: Game[] };

export type Store = { version: 2; groups: Scoreboard[] };

export type GroupSummary = {
  id: string;
  players: Player[];
  gameCount: number;
  lastPlayedOn?: string;
};

export type GroupMutation =
  | { type: "addGame"; groupId: string; game: Partial<Game> }
  | { type: "deleteGame"; groupId: string; id: string }
  | { type: "addPlayer"; groupId: string; name: string }
  | { type: "renamePlayer"; groupId: string; id: string; name: string }
  | { type: "recolorPlayer"; groupId: string; id: string; color: string };

export type Mutation =
  | GroupMutation
  | { type: "createGroup"; id?: string; names: string[]; colors?: string[] }
  | { type: "deleteGroup"; groupId: string };

// The four settlement colors in the box: orange, blue, black, white.
export const PLAYER_COLORS = ["#d9822b", "#3a6fb0", "#2b2118", "#f7f3ea"] as const;
export const COLOR_IDS = ["orange", "blue", "black", "white"] as const;
const LEGACY_WHITE = "#8b9097"; // white used to be drawn grey

const isPaletteColor = (c: unknown): c is string => PLAYER_COLORS.includes(c as (typeof PLAYER_COLORS)[number]);

/** First color nobody in the group has yet (colors repeat only with a 5th player). */
function freeColor(players: Player[]): string {
  return PLAYER_COLORS.find((c) => !players.some((p) => p.color === c)) ?? PLAYER_COLORS[players.length % PLAYER_COLORS.length];
}
export const MIN_PLAYERS = 2;
export const MAX_PLAYERS = 5;
export const MAX_GOLD = 400;
export const MAX_GROUPS = 20;

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

/** Validation failure; `code` is an i18n error code. */
export class ScoreboardError extends Error {
  constructor(public code: ErrorCode) {
    super(code);
  }
}

export function emptyStore(): Store {
  return { version: 2, groups: [] };
}

type LegacyBoard = { version: 1; players: Player[]; games: Game[]; setupDone?: boolean };

/** Reads any stored version; the single-board v1 document becomes the first group. */
const fixColors = (players: Player[]) =>
  players.map((p) => (p.color === LEGACY_WHITE ? { ...p, color: PLAYER_COLORS[3] } : p));

export function migrate(data: unknown): Store {
  const doc = data as Partial<Store> & Partial<LegacyBoard>;
  if (doc?.version === 2 && Array.isArray(doc.groups)) {
    return { version: 2, groups: doc.groups.map((g) => ({ ...g, players: fixColors(g.players) })) };
  }
  if (doc?.version === 1 && Array.isArray(doc.players) && Array.isArray(doc.games)) {
    if (!doc.setupDone && doc.games.length === 0) return emptyStore();
    const createdAt = doc.games[0]?.createdAt ?? new Date().toISOString();
    return { version: 2, groups: [{ id: "legacy", createdAt, players: fixColors(doc.players), games: doc.games }] };
  }
  return emptyStore();
}

/** Groups for the player picker, most recently played first. */
export function summarize(store: Store): GroupSummary[] {
  const lastActivity = (g: Scoreboard) => g.games.at(-1)?.createdAt ?? g.createdAt;
  return [...store.groups]
    .sort((a, b) => lastActivity(b).localeCompare(lastActivity(a)))
    .map((g) => ({ id: g.id, players: g.players, gameCount: g.games.length, lastPlayedOn: g.games.at(-1)?.playedOn }));
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

const sameName = (a: string, b: string) => a.toLocaleLowerCase("tr") === b.toLocaleLowerCase("tr");

function newId() {
  return crypto.randomUUID();
}

function applyToGroup(board: Scoreboard, m: GroupMutation): Scoreboard {
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
    case "deleteGame":
      return { ...board, games: board.games.filter((g) => g.id !== m.id) };
    case "addPlayer": {
      if (board.players.length >= MAX_PLAYERS) throw new ScoreboardError("max_players");
      const name = cleanName(m.name);
      if (board.players.some((p) => sameName(p.name, name))) throw new ScoreboardError("names_distinct");
      return { ...board, players: [...board.players, { id: newId(), name, color: freeColor(board.players) }] };
    }
    case "renamePlayer": {
      const name = cleanName(m.name);
      if (!board.players.some((p) => p.id === m.id)) throw new ScoreboardError("player_not_found");
      if (board.players.some((p) => p.id !== m.id && sameName(p.name, name))) {
        throw new ScoreboardError("names_distinct");
      }
      return { ...board, players: board.players.map((p) => (p.id === m.id ? { ...p, name } : p)) };
    }
    case "recolorPlayer": {
      const player = board.players.find((p) => p.id === m.id);
      if (!player) throw new ScoreboardError("player_not_found");
      if (!isPaletteColor(m.color)) throw new ScoreboardError("generic");
      // Taking a color someone already has swaps the two colors.
      return {
        ...board,
        players: board.players.map((p) =>
          p.id === player.id ? { ...p, color: m.color } : p.color === m.color ? { ...p, color: player.color } : p,
        ),
      };
    }
    default:
      throw new ScoreboardError("generic");
  }
}

/** Applies a mutation; returns the new store and the id of the group it touched. */
export function applyMutation(store: Store, m: Mutation): { store: Store; groupId?: string } {
  if (m.type === "createGroup") {
    const id = typeof m.id === "string" && m.id ? m.id : newId();
    if (store.groups.some((g) => g.id === id)) return { store, groupId: id }; // idempotent retry
    if (store.groups.length >= MAX_GROUPS) throw new ScoreboardError("max_groups");
    const names = Array.isArray(m.names) ? m.names.map(cleanName) : [];
    if (names.length < MIN_PLAYERS || names.length > MAX_PLAYERS) throw new ScoreboardError("names_count");
    if (new Set(names.map((n) => n.toLocaleLowerCase("tr"))).size !== names.length) {
      throw new ScoreboardError("names_distinct");
    }
    const group: Scoreboard = {
      id,
      createdAt: new Date().toISOString(),
      players: names.reduce<Player[]>((players, name, i) => {
        const wanted = m.colors?.[i];
        const color = isPaletteColor(wanted) ? wanted : freeColor(players);
        return [...players, { id: newId(), name, color }];
      }, []),
      games: [],
    };
    return { store: { ...store, groups: [...store.groups, group] }, groupId: id };
  }

  if (m.type === "deleteGroup") {
    return { store: { ...store, groups: store.groups.filter((g) => g.id !== m.groupId) } };
  }

  const board = store.groups.find((g) => g.id === m.groupId);
  if (!board) throw new ScoreboardError("group_not_found");
  const next = applyToGroup(board, m);
  if (next === board) return { store, groupId: board.id };
  return { store: { ...store, groups: store.groups.map((g) => (g.id === board.id ? next : g)) }, groupId: board.id };
}
