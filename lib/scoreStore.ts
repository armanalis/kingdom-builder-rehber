import "server-only";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { BlobPreconditionFailedError, get, put } from "@vercel/blob";
import { applyMutation, emptyScoreboard, type Mutation, type Scoreboard } from "./scoreboard";

// Production: one private JSON document in Vercel Blob, updated with optimistic
// concurrency (ifMatch). Local development without a Blob token: a JSON file.
// SCOREBOARD_STORE=file forces the local file (e.g. to test without touching real data).
const BLOB_PATH = process.env.SCOREBOARD_BLOB_PATH ?? "kingdom-builder/scoreboard.json";
const LOCAL_FILE = path.join(process.cwd(), ".data", "scoreboard.json");
const blobConfigured = () =>
  process.env.SCOREBOARD_STORE !== "file" && Boolean(process.env.BLOB_READ_WRITE_TOKEN || process.env.BLOB_STORE_ID);

type Snapshot = { board: Scoreboard; etag?: string };

function parse(text: string): Scoreboard {
  const data = JSON.parse(text) as Scoreboard;
  return data?.version === 1 && Array.isArray(data.players) && Array.isArray(data.games)
    ? data
    : emptyScoreboard();
}

async function read(): Promise<Snapshot> {
  if (!blobConfigured()) {
    try {
      return { board: parse(await readFile(LOCAL_FILE, "utf8")) };
    } catch {
      return { board: emptyScoreboard() };
    }
  }
  const res = await get(BLOB_PATH, { access: "private", useCache: false });
  if (!res || res.statusCode !== 200) return { board: emptyScoreboard() };
  return { board: parse(await new Response(res.stream).text()), etag: res.blob.etag };
}

async function write(board: Scoreboard, etag: string | undefined) {
  const body = JSON.stringify(board);
  if (!blobConfigured()) {
    await mkdir(path.dirname(LOCAL_FILE), { recursive: true });
    await writeFile(LOCAL_FILE, body);
    return;
  }
  await put(BLOB_PATH, body, {
    access: "private",
    contentType: "application/json",
    addRandomSuffix: false,
    // First write must not clobber a document created concurrently; later writes must
    // be based on the version we read.
    ...(etag ? { ifMatch: etag } : { allowOverwrite: false }),
  });
}

export async function loadScoreboard(): Promise<Scoreboard> {
  return (await read()).board;
}

export async function mutateScoreboard(mutation: Mutation): Promise<Scoreboard> {
  for (let attempt = 0; ; attempt++) {
    const { board, etag } = await read();
    const next = applyMutation(board, mutation);
    if (next === board) return board;
    try {
      await write(next, etag);
      return next;
    } catch (error) {
      // Someone else saved in between: re-read and re-apply.
      const conflict = error instanceof BlobPreconditionFailedError || (!etag && blobConfigured());
      if (!conflict || attempt >= 3) throw error;
    }
  }
}
