import { streamText, type ModelMessage } from "ai";
import { answerModels, gatewayFallbacks } from "@/lib/ai";
import { buildSystemPrompt } from "@/lib/rules";
import { ERROR_MARKER, errorCode } from "@/lib/errors";
import { isLang } from "@/lib/i18n";

export const maxDuration = 60;

const MAX_TURNS = 8;
const MAX_QUESTION_CHARS = 800;
const MAX_TURN_CHARS = 2500;
const PHOTO_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const MAX_PHOTO_BASE64 = 4_000_000; // ~3 MB; the browser shrinks photos far below this

type Photo = { data: string; mediaType: string };

function parsePhoto(input: unknown): Photo | null | undefined {
  if (input === undefined || input === null) return undefined;
  const { data, mediaType } = input as { data?: unknown; mediaType?: unknown };
  if (typeof data !== "string" || typeof mediaType !== "string") return null;
  if (!PHOTO_TYPES.has(mediaType) || data.length > MAX_PHOTO_BASE64) return null;
  return { data, mediaType };
}

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
  let body: { messages?: unknown; lang?: unknown; photo?: unknown };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "bad_request" }, { status: 400 });
  }
  const messages = parseMessages(body?.messages);
  const photo = parsePhoto(body?.photo);
  if (!messages || photo === null) {
    return Response.json({ error: photo === null ? "photo_failed" : "bad_request" }, { status: 400 });
  }
  // The photo belongs to the newest question.
  if (photo) {
    const last = messages.length - 1;
    messages[last] = {
      role: "user",
      content: [
        { type: "text", text: messages[last].content as string },
        { type: "file", mediaType: photo.mediaType, data: photo.data },
      ],
    };
  }
  const instructions = buildSystemPrompt(isLang(body.lang) ? body.lang : "tr");
  const models = answerModels();

  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      let sentText = false;
      for (const [i, model] of models.entries()) {
        try {
          const result = streamText({
            model,
            instructions,
            messages,
            reasoning: "low",
            maxOutputTokens: 4000,
            providerOptions: gatewayFallbacks(),
          });
          for await (const part of result.fullStream) {
            if (part.type === "text-delta") {
              sentText = true;
              controller.enqueue(encoder.encode(part.text));
            } else if (part.type === "error") {
              throw part.error;
            }
          }
          break;
        } catch (error) {
          console.error("ask failed", error);
          // Try the next model only if nothing has reached the user yet.
          if (sentText || i === models.length - 1) {
            controller.enqueue(encoder.encode(ERROR_MARKER + errorCode(error)));
            break;
          }
        }
      }
      controller.close();
    },
  });

  return new Response(stream, {
    headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" },
  });
}
