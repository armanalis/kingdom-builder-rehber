import type { GroupSummary, Mutation, Scoreboard } from "./scoreboard";

/** Error from the scores API; `code` is an i18n error code. */
export class ApiError extends Error {
  constructor(public code: string) {
    super(code);
  }
}

async function request<T>(input: string, init: RequestInit | undefined, fallback: string): Promise<T> {
  let res: Response;
  try {
    res = await fetch(input, { cache: "no-store", ...init });
  } catch {
    throw new ApiError(fallback);
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(typeof data.error === "string" ? data.error : fallback);
  return data as T;
}

export async function fetchGroups(): Promise<GroupSummary[]> {
  return (await request<{ groups: GroupSummary[] }>("/api/scores", undefined, "load_failed")).groups;
}

export function fetchScoreboard(groupId: string): Promise<Scoreboard> {
  return request(`/api/scores?group=${encodeURIComponent(groupId)}`, undefined, "load_failed");
}

const post = <T>(mutation: Mutation) =>
  request<T>(
    "/api/scores",
    { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(mutation) },
    "save_failed",
  );

/** Group-level changes (add game, rename player, create group…); returns the updated group. */
export const sendMutation = (mutation: Exclude<Mutation, { type: "deleteGroup" }>) => post<Scoreboard>(mutation);

export async function deleteGroup(groupId: string): Promise<GroupSummary[]> {
  return (await post<{ groups: GroupSummary[] }>({ type: "deleteGroup", groupId })).groups;
}

export const errorCodeOf = (error: unknown) => (error instanceof ApiError ? error.code : "generic");
