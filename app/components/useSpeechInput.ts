"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import type { ErrorCode, Lang } from "@/lib/i18n";

// Minimal Web Speech API typings (not part of TypeScript's DOM lib).
type RecognitionResultList = ArrayLike<{ isFinal: boolean } & ArrayLike<{ transcript: string }>>;
type Recognition = {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  maxAlternatives: number;
  onresult: ((e: { results: RecognitionResultList }) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
  start(): void;
  stop(): void;
  abort(): void;
};
type RecognitionCtor = new () => Recognition;

export type SpeechStatus = "idle" | "listening" | "transcribing";

// Errors meaning "the browser's recognizer can't work here" -> switch to server transcription.
const FALLBACK_ERRORS = new Set(["service-not-allowed", "network", "language-not-supported"]);

const SILENCE_MS = 1600;
const NO_SPEECH_MS = 9000;
const MAX_RECORDING_MS = 25000;

function getRecognitionCtor(): RecognitionCtor | undefined {
  const w = window as unknown as { SpeechRecognition?: RecognitionCtor; webkitSpeechRecognition?: RecognitionCtor };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition;
}

const subscribeNever = () => () => {};

function canRecord() {
  return typeof MediaRecorder !== "undefined" && !!navigator.mediaDevices?.getUserMedia;
}

export function useSpeechInput(lang: Lang, onText: (text: string) => void, onError: (code: ErrorCode) => void) {
  const [status, setStatus] = useState<SpeechStatus>("idle");
  const [interim, setInterim] = useState("");
  const supported = useSyncExternalStore(
    subscribeNever,
    () => !!getRecognitionCtor() || canRecord(),
    () => true,
  );
  const stopRef = useRef<(() => void) | null>(null);
  const useServerRef = useRef(false);

  // Keep the latest callbacks without re-creating start().
  const onTextRef = useRef(onText);
  const onErrorRef = useRef(onError);
  const langRef = useRef(lang);
  useEffect(() => {
    onTextRef.current = onText;
    onErrorRef.current = onError;
    langRef.current = lang;
  });

  useEffect(() => () => stopRef.current?.(), []);

  const startRecorder = useCallback(async () => {
    if (!canRecord()) {
      onErrorRef.current("unsupported");
      return;
    }
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true },
      });
    } catch {
      onErrorRef.current("mic_permission");
      return;
    }

    const mimeType = ["audio/webm;codecs=opus", "audio/mp4", "audio/webm"].find((t) =>
      MediaRecorder.isTypeSupported(t),
    );
    const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
    const chunks: Blob[] = [];
    recorder.ondataavailable = (e) => {
      if (e.data.size) chunks.push(e.data);
    };

    // Auto-stop after the speaker goes quiet (only if audio analysis is allowed to run).
    const ctx = new AudioContext();
    await ctx.resume().catch(() => {});
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 1024;
    ctx.createMediaStreamSource(stream).connect(analyser);
    const samples = new Float32Array(analyser.fftSize);
    const canDetect = ctx.state === "running";
    const startedAt = performance.now();
    let heardSpeech = !canDetect;
    let lastLoudAt = startedAt;

    const stop = () => {
      if (recorder.state !== "inactive") recorder.stop();
    };

    const timer = window.setInterval(() => {
      const now = performance.now();
      if (canDetect) {
        analyser.getFloatTimeDomainData(samples);
        let sum = 0;
        for (const s of samples) sum += s * s;
        if (Math.sqrt(sum / samples.length) > 0.02) {
          heardSpeech = true;
          lastLoudAt = now;
        }
      }
      const silentTooLong = canDetect && heardSpeech && now - lastLoudAt > SILENCE_MS;
      const nothingSaid = canDetect && !heardSpeech && now - startedAt > NO_SPEECH_MS;
      if (silentTooLong || nothingSaid || now - startedAt > MAX_RECORDING_MS) stop();
    }, 100);

    recorder.onstop = async () => {
      window.clearInterval(timer);
      stream.getTracks().forEach((t) => t.stop());
      ctx.close().catch(() => {});
      stopRef.current = null;

      const audio = new Blob(chunks, { type: recorder.mimeType || "audio/webm" });
      if (!heardSpeech || audio.size < 2000) {
        setStatus("idle");
        onErrorRef.current("no_speech");
        return;
      }
      setStatus("transcribing");
      try {
        const form = new FormData();
        form.append("audio", audio, audio.type.includes("mp4") ? "question.m4a" : "question.webm");
        form.append("lang", langRef.current);
        const res = await fetch("/api/transcribe", { method: "POST", body: form });
        const data = (await res.json().catch(() => ({}))) as { text?: string; error?: ErrorCode };
        if (res.ok && data.text) onTextRef.current(data.text);
        else onErrorRef.current(data.error ?? "transcribe_failed");
      } catch {
        onErrorRef.current("transcribe_failed");
      } finally {
        setStatus("idle");
      }
    };

    stopRef.current = stop;
    recorder.start();
    setStatus("listening");
  }, []);

  const startBrowserRecognition = useCallback(
    (Ctor: RecognitionCtor) => {
      const rec = new Ctor();
      rec.lang = langRef.current === "tr" ? "tr-TR" : "en-US";
      rec.interimResults = true;
      rec.continuous = false;
      rec.maxAlternatives = 1;

      let transcript = "";
      let errorCode = "";

      rec.onresult = (e) => {
        let text = "";
        for (let i = 0; i < e.results.length; i++) text += e.results[i][0].transcript;
        transcript = text.trim();
        setInterim(transcript);
      };
      rec.onerror = (e) => {
        errorCode = e.error;
      };
      rec.onend = () => {
        stopRef.current = null;
        setInterim("");
        setStatus("idle");
        if (FALLBACK_ERRORS.has(errorCode)) {
          useServerRef.current = true;
          void startRecorder();
        } else if (errorCode === "not-allowed") {
          onErrorRef.current("mic_permission");
        } else if (transcript) {
          onTextRef.current(transcript);
        } else if (errorCode !== "aborted") {
          onErrorRef.current("no_speech");
        }
      };

      stopRef.current = () => rec.stop();
      try {
        rec.start();
        setStatus("listening");
      } catch {
        stopRef.current = null;
        useServerRef.current = true;
        void startRecorder();
      }
    },
    [startRecorder],
  );

  const toggle = useCallback(() => {
    if (status === "transcribing") return;
    if (stopRef.current) {
      stopRef.current();
      return;
    }
    const Ctor = getRecognitionCtor();
    if (Ctor && !useServerRef.current) startBrowserRecognition(Ctor);
    else void startRecorder();
  }, [status, startBrowserRecognition, startRecorder]);

  return { status, interim, supported, toggle };
}
