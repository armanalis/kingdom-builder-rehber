import { loadScoreboard, mutateScoreboard } from "@/lib/scoreStore";
import { ScoreboardError, type Mutation } from "@/lib/scoreboard";

export const dynamic = "force-dynamic";

const noStore = { "Cache-Control": "no-store" };

export async function GET() {
  try {
    return Response.json(await loadScoreboard(), { headers: noStore });
  } catch (error) {
    console.error("load scoreboard failed", error);
    return Response.json({ error: "load_failed" }, { status: 500, headers: noStore });
  }
}

export async function POST(req: Request) {
  let mutation: Mutation;
  try {
    mutation = (await req.json()) as Mutation;
  } catch {
    return Response.json({ error: "generic" }, { status: 400 });
  }
  try {
    return Response.json(await mutateScoreboard(mutation), { headers: noStore });
  } catch (error) {
    if (error instanceof ScoreboardError) {
      return Response.json({ error: error.code }, { status: 400 });
    }
    console.error("save scoreboard failed", error);
    return Response.json({ error: "save_failed" }, { status: 500 });
  }
}
