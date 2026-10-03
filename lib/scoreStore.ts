import "server-only";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { BlobPreconditionFailedError, get, put } from "@vercel/blob";
import { applyMutation, emptyStore, migrate, type Mutation, type Store } from "./scoreboard";

// Production: one private JSON document in Vercel Blob, updated with optimistic
// concurrency (ifMatch). Local development without a Blob token: a JSON file.
// SCOREBOARD_STORE=file forces the local file (e.g. to test without touching real data).
const BLOB_PATH = process.env.SCOREBOARD_BLOB_PATH ?? "kingdom-builder/scoreboard.json";
const LOCAL_FILE = path.join(process.cwd(), ".data", "scoreboard.json");
const blobConfigured = () =>
  process.env.SCOREBOARD_STORE !== "file" && Boolean(process.env.BLOB_READ_WRITE_TOKEN || process.env.BLOB_STORE_ID);

type Snapshot = { store: Store; etag?: string };

async function read(): Promise<Snapshot> {
  if (!blobConfigured()) {
    try {
      return { store: migrate(JSON.parse(await readFile(LOCAL_FILE, "utf8"))) };
    } catch {
      return { store: emptyStore() };
    }
  }
  const res = await get(BLOB_PATH, { access: "private", useCache: false });
  if (!res || res.statusCode !== 200) return { store: emptyStore() };
  return { store: migrate(JSON.parse(await new Response(res.stream).text())), etag: res.blob.etag };
}

async function write(store: Store, etag: string | undefined) {
  const body = JSON.stringify(store);
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

export async function loadStore(): Promise<Store> {
  return (await read()).store;
}

export async function mutateStore(mutation: Mutation): Promise<{ store: Store; groupId?: string }> {
  for (let attempt = 0; ; attempt++) {
    const { store, etag } = await read();
    const result = applyMutation(store, mutation);
    if (result.store === store) return result;
    try {
      await write(result.store, etag);
      return result;
    } catch (error) {
      // Someone else saved in between: re-read and re-apply.
      const conflict = error instanceof BlobPreconditionFailedError || (!etag && blobConfigured());
      if (!conflict || attempt >= 3) throw error;
    }
  }
}
