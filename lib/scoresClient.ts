import type { Mutation, Scoreboard } from "./scoreboard";

/** Error from the scores API; `code` is an i18n error code. */
export class ApiError extends Error {
  constructor(public code: string) {
    super(code);
  }
}

async function handle(res: Response): Promise<Scoreboard> {
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(typeof data.error === "string" ? data.error : "generic");
  return data as Scoreboard;
}

export async function fetchScoreboard(): Promise<Scoreboard> {
  try {
    return await handle(await fetch("/api/scores", { cache: "no-store" }));
  } catch (error) {
    throw error instanceof ApiError ? error : new ApiError("load_failed");
  }
}

export async function sendMutation(mutation: Mutation): Promise<Scoreboard> {
  try {
    return await handle(
      await fetch("/api/scores", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(mutation),
      }),
    );
  } catch (error) {
    throw error instanceof ApiError ? error : new ApiError("save_failed");
  }
}

export const errorCodeOf = (error: unknown) => (error instanceof ApiError ? error.code : "generic");
