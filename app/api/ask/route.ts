import { streamText, type ModelMessage } from "ai";
import { buildSystemPrompt } from "@/lib/rules";
import { ERROR_MARKER, errorCode } from "@/lib/errors";
import { isLang } from "@/lib/i18n";

export const maxDuration = 60;

// Both defaults are in the AI Gateway free tier. Override with env vars if credits are bought.
const MODEL = process.env.AI_GATEWAY_MODEL ?? "openai/gpt-5.2";
const FALLBACK_MODELS = (process.env.AI_GATEWAY_FALLBACK_MODELS ?? "google/gemini-2.5-flash")
  .split(",")
  .map((m) => m.trim())
  .filter(Boolean);

const MAX_TURNS = 8;
const MAX_QUESTION_CHARS = 800;
const MAX_TURN_CHARS = 2500;

function parseMessages(input: unknown): ModelMessage[] | null {
  if (!Array.isArray(input) || input.length === 0) return null;
  const turns = input.slice(-MAX_TURNS).flatMap((m): ModelMessage[] => {
    if (!m || typeof m !== "object") return [];
    const { role, content } = m as { role?: unknown; content?: unknown };
    if ((role !== "user" && role !== "assistant") || typeof content !== "string") return [];
    const text = content.trim().slice(0, MAX_TURN_CHARS);
    return text ? [{ role, content: text }] : [];
  });
  const last = turns.at(-1);
  if (!last || last.role !== "user" || (last.content as string).length > MAX_QUESTION_CHARS) {
    return null;
  }
  // Conversations must start with a user turn.
  while (turns.length && turns[0].role !== "user") turns.shift();
  return turns;
}

export async function POST(req: Request) {
  let body: { messages?: unknown; lang?: unknown };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "bad_request" }, { status: 400 });
  }
  const messages = parseMessages(body?.messages);
  if (!messages) {
    return Response.json({ error: "bad_request" }, { status: 400 });
  }

  const result = streamText({
    model: MODEL,
    instructions: buildSystemPrompt(isLang(body.lang) ? body.lang : "tr"),
    messages,
    reasoning: "low",
    maxOutputTokens: 4000,
    providerOptions: { gateway: { models: FALLBACK_MODELS } },
  });

  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        for await (const part of result.fullStream) {
          if (part.type === "text-delta") controller.enqueue(encoder.encode(part.text));
          else if (part.type === "error") throw part.error;
        }
      } catch (error) {
        console.error("ask failed", error);
        controller.enqueue(encoder.encode(ERROR_MARKER + errorCode(error)));
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" },
  });
}
