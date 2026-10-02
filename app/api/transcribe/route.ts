import { generateText, transcribe } from "ai";
import { gatewayTranscriber, geminiListener, usingGemini } from "@/lib/ai";
import { errorCode } from "@/lib/errors";
import { isLang } from "@/lib/i18n";

export const maxDuration = 30;

// Used only when the browser has no built-in speech recognition.
const MAX_BYTES = 8 * 1024 * 1024;

const TERMS =
  "Farmers, Lords, Knights, Discoverers, Merchants, Citizens, Hermits, Fishermen, Miners, Workers, " +
  "Oracle, Farm, Oasis, Tower, Tavern, Barn, Harbor, Paddock, Grass, Canyon, Desert, Flower Field, Forest";

// Vocabulary hint so English component names are spelled correctly.
const VOCABULARY = {
  tr: `Kingdom Builder oyunu hakkında Türkçe bir soru. Geçebilecek kelimeler: ${TERMS}, yerleşim, çeyrek.`,
  en: `A question about the board game Kingdom Builder. Possible words: ${TERMS}, settlement, sector.`,
};

async function toText(audio: Uint8Array, mediaType: string, lang: "tr" | "en") {
  if (usingGemini()) {
    const { text } = await generateText({
      model: geminiListener(),
      messages: [
        {
          role: "user",
          content: [
            {
              type: "text",
              text: `Transcribe this recording word for word in ${lang === "tr" ? "Turkish" : "English"}. ${VOCABULARY[lang]} Reply with the transcript only.`,
            },
            { type: "file", mediaType, data: audio },
          ],
        },
      ],
    });
    return text;
  }
  const { text } = await transcribe({
    model: gatewayTranscriber(),
    audio,
    providerOptions: { openai: { language: lang, prompt: VOCABULARY[lang] } },
  });
  return text;
}

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
    const mediaType = file.type.split(";")[0] || "audio/webm";
    const text = await toText(new Uint8Array(await file.arrayBuffer()), mediaType, lang);
    return Response.json({ text: text.trim() });
  } catch (error) {
    console.error("transcribe failed", error);
    return Response.json({ error: errorCode(error) }, { status: 502 });
  }
}
