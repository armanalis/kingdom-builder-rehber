"use client";

import type { Lang } from "@/lib/i18n";

function plainText(markdown: string, lang: Lang) {
  return markdown
    .replace(/[*_`#>]/g, "")
    .replace(/^\s*[-•]\s+/gm, "")
    .replace(/×/g, lang === "tr" ? " çarpı " : " times ")
    .replace(/\s+\n/g, "\n")
    .trim();
}

function voiceFor(lang: Lang) {
  return window.speechSynthesis.getVoices().find((v) => v.lang.toLowerCase().startsWith(lang));
}

export function canSpeak() {
  return typeof window !== "undefined" && "speechSynthesis" in window;
}

// iOS only allows speech that was started from a user gesture; calling this
// during a tap unlocks later (asynchronous) speech.
export function unlockSpeech() {
  if (!canSpeak()) return;
  const u = new SpeechSynthesisUtterance("");
  window.speechSynthesis.speak(u);
}

export function speak(markdown: string, lang: Lang, onEnd?: () => void) {
  if (!canSpeak()) return;
  window.speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(plainText(markdown, lang));
  u.lang = lang === "tr" ? "tr-TR" : "en-US";
  const voice = voiceFor(lang);
  if (voice) u.voice = voice;
  u.rate = 1;
  u.onend = () => onEnd?.();
  u.onerror = () => onEnd?.();
  window.speechSynthesis.speak(u);
}

export function stopSpeaking() {
  if (canSpeak()) window.speechSynthesis.cancel();
}
