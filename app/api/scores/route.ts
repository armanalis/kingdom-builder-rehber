import { loadStore, mutateStore } from "@/lib/scoreStore";
import { ScoreboardError, summarize, type Mutation } from "@/lib/scoreboard";

export const dynamic = "force-dynamic";

const noStore = { "Cache-Control": "no-store" };

/**
 * `?group=<id>` returns that group's scoreboard. `?groups=<id>,<id>` returns summaries of
 * just those groups (the ones this phone knows). There is no public list of all groups:
 * knowing a group's id (from its invite link) is what gives access.
 */
export async function GET(req: Request) {
  const params = new URL(req.url).searchParams;
  const groupId = params.get("group");
  try {
    const store = await loadStore();
    if (!groupId) {
      const wanted = new Set((params.get("groups") ?? "").split(",").filter(Boolean).slice(0, 50));
      const groups = summarize(store).filter((g) => wanted.has(g.id));
      return Response.json({ groups }, { headers: noStore });
    }
    const group = store.groups.find((g) => g.id === groupId);
    if (!group) return Response.json({ error: "group_not_found" }, { status: 404, headers: noStore });
    return Response.json(group, { headers: noStore });
  } catch (error) {
    console.error("load scoreboard failed", error);
    return Response.json({ error: "load_failed" }, { status: 500, headers: noStore });
  }
}

/** Applies a mutation; returns the touched group, or the group list after deleting a group. */
export async function POST(req: Request) {
  let mutation: Mutation;
  try {
    mutation = (await req.json()) as Mutation;
  } catch {
    return Response.json({ error: "generic" }, { status: 400 });
  }
  try {
    const { store, groupId } = await mutateStore(mutation);
    if (mutation.type === "deleteGroup") return Response.json({ ok: true }, { headers: noStore });
    const group = store.groups.find((g) => g.id === groupId);
    if (!group) return Response.json({ error: "group_not_found" }, { status: 404 });
    return Response.json(group, { headers: noStore });
  } catch (error) {
    if (error instanceof ScoreboardError) {
      return Response.json({ error: error.code }, { status: error.code === "group_not_found" ? 404 : 400 });
    }
    console.error("save scoreboard failed", error);
    return Response.json({ error: "save_failed" }, { status: 500 });
  }
}
