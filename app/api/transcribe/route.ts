import { transcribe } from "ai";
import { errorCode } from "@/lib/errors";
import { isLang } from "@/lib/i18n";

export const maxDuration = 30;

// Used only when the browser has no built-in speech recognition.
const MODEL = process.env.AI_GATEWAY_TRANSCRIBE_MODEL ?? "openai/gpt-4o-mini-transcribe";
const MAX_BYTES = 8 * 1024 * 1024;

const TERMS =
  "Farmers, Lords, Knights, Discoverers, Merchants, Citizens, Hermits, Fishermen, Miners, Workers, " +
  "Oracle, Farm, Oasis, Tower, Tavern, Barn, Harbor, Paddock, Grass, Canyon, Desert, Flower Field, Forest";

// Vocabulary hint so English component names are spelled correctly.
const VOCABULARY = {
  tr: `Kingdom Builder oyunu hakkında Türkçe bir soru. Geçebilecek kelimeler: ${TERMS}, yerleşim, çeyrek.`,
  en: `A question about the board game Kingdom Builder. Possible words: ${TERMS}, settlement, sector.`,
};

export async function POST(req: Request) {
  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return Response.json({ error: "transcribe_failed" }, { status: 400 });
  }
  const file = form.get("audio");
  const lang = isLang(form.get("lang")) ? (form.get("lang") as "tr" | "en") : "tr";
  if (!(file instanceof Blob) || file.size === 0) {
    return Response.json({ error: "no_speech" }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return Response.json({ error: "audio_too_long" }, { status: 413 });
  }

  try {
    const { text } = await transcribe({
      model: MODEL,
      audio: new Uint8Array(await file.arrayBuffer()),
      providerOptions: { openai: { language: lang, prompt: VOCABULARY[lang] } },
    });
    return Response.json({ text: text.trim() });
  } catch (error) {
    console.error("transcribe failed", error);
    return Response.json({ error: errorCode(error) }, { status: 502 });
  }
}
