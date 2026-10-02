import { transcribe } from "ai";
import { friendlyError } from "@/lib/errors";

export const maxDuration = 30;

// Used only when the browser has no built-in speech recognition.
const MODEL = process.env.AI_GATEWAY_TRANSCRIBE_MODEL ?? "openai/gpt-4o-mini-transcribe";
const MAX_BYTES = 8 * 1024 * 1024;

// Vocabulary hint so English component names inside Turkish speech are spelled correctly.
const VOCABULARY =
  "Kingdom Builder oyunu hakkında Türkçe bir soru. Geçebilecek kelimeler: Farmers, Lords, Knights, " +
  "Discoverers, Merchants, Citizens, Hermits, Fishermen, Miners, Workers, Oracle, Farm, Oasis, " +
  "Tower, Tavern, Barn, Harbor, Paddock, Grass, Canyon, Desert, Flower Field, Forest, yerleşim, çeyrek.";

export async function POST(req: Request) {
  let file: FormDataEntryValue | null;
  try {
    file = (await req.formData()).get("audio");
  } catch {
    return Response.json({ error: "Ses kaydı alınamadı." }, { status: 400 });
  }
  if (!(file instanceof Blob) || file.size === 0) {
    return Response.json({ error: "Ses kaydı boş." }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return Response.json({ error: "Ses kaydı çok uzun." }, { status: 413 });
  }

  try {
    const { text } = await transcribe({
      model: MODEL,
      audio: new Uint8Array(await file.arrayBuffer()),
      providerOptions: { openai: { language: "tr", prompt: VOCABULARY } },
    });
    return Response.json({ text: text.trim() });
  } catch (error) {
    console.error("transcribe failed", error);
    return Response.json({ error: friendlyError(error) }, { status: 502 });
  }
}
