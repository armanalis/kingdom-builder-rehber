import "server-only";
import { google } from "@ai-sdk/google";
import type { LanguageModel } from "ai";

// With GOOGLE_GENERATIVE_AI_API_KEY set, the app calls the free Gemini API tier directly.
// Otherwise it goes through Vercel AI Gateway.
export const usingGemini = () => Boolean(process.env.GOOGLE_GENERATIVE_AI_API_KEY);

const list = (value: string) =>
  value
    .split(",")
    .map((m) => m.trim())
    .filter(Boolean);

/**
 * Models to try in order. Each Gemini model has its own free daily quota, so a
 * later model takes over when an earlier one hits its limit.
 */
export function answerModels(): LanguageModel[] {
  if (usingGemini()) {
    return list(process.env.GEMINI_MODELS ?? "gemini-3.8-flash,gemini-2.5-flash").map((id) => google(id));
  }
  return [process.env.AI_GATEWAY_MODEL ?? "openai/gpt-5.2"];
}

/** AI Gateway does its own model fallback; the direct Gemini path falls back in our loop. */
export function gatewayFallbacks() {
  if (usingGemini()) return undefined;
  return { gateway: { models: list(process.env.AI_GATEWAY_FALLBACK_MODELS ?? "google/gemini-2.5-flash") } };
}

/** Gemini listens to audio directly (a regular language model with an audio file attached). */
export const geminiListener = () => google(process.env.GEMINI_TRANSCRIBE_MODEL ?? "gemini-2.5-flash");

/** Dedicated speech-to-text model on AI Gateway. */
export const gatewayTranscriber = () => process.env.AI_GATEWAY_TRANSCRIBE_MODEL ?? "openai/gpt-4o-mini-transcribe";
