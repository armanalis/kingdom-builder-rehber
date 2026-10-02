"use client";

function plainText(markdown: string) {
  return markdown
    .replace(/[*_`#>]/g, "")
    .replace(/^\s*[-•]\s+/gm, "")
    .replace(/×/g, " çarpı ")
    .replace(/\s+\n/g, "\n")
    .trim();
}

function turkishVoice() {
  return window.speechSynthesis.getVoices().find((v) => v.lang.toLowerCase().startsWith("tr"));
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

export function speak(markdown: string, onEnd?: () => void) {
  if (!canSpeak()) return;
  window.speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(plainText(markdown));
  u.lang = "tr-TR";
  const voice = turkishVoice();
  if (voice) u.voice = voice;
  u.rate = 1;
  u.onend = () => onEnd?.();
  u.onerror = () => onEnd?.();
  window.speechSynthesis.speak(u);
}

export function stopSpeaking() {
  if (canSpeak()) window.speechSynthesis.cancel();
}
