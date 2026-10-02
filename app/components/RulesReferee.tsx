"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type FormEvent,
  type KeyboardEvent,
} from "react";
import Markdown from "react-markdown";
import { ERROR_MARKER } from "@/lib/errors";
import { QUICK_QUESTIONS } from "@/lib/cards";
import { CardGuide } from "./CardGuide";
import { SiteNav } from "./SiteNav";
import { canSpeak, speak, stopSpeaking, unlockSpeech } from "./speak";
import { useSpeechInput } from "./useSpeechInput";

type Entry = {
  id: string;
  question: string;
  answer: string;
  state: "streaming" | "done" | "error";
  error?: string;
};

const HISTORY_TURNS = 3;
const MAX_ENTRIES = 12;
const AUTO_READ_KEY = "kb-auto-read";

// "Read answers aloud" preference, persisted in localStorage.
const autoReadListeners = new Set<() => void>();
const subscribeAutoRead = (listener: () => void) => {
  autoReadListeners.add(listener);
  return () => autoReadListeners.delete(listener);
};
const getAutoRead = () => localStorage.getItem(AUTO_READ_KEY) !== "0";
const subscribeNever = () => () => {};

export function RulesReferee() {
  const [entries, setEntries] = useState<Entry[]>([]);
  const [input, setInput] = useState("");
  const [notice, setNotice] = useState("");
  const autoRead = useSyncExternalStore(subscribeAutoRead, getAutoRead, () => true);
  const ttsAvailable = useSyncExternalStore(subscribeNever, canSpeak, () => false);
  const [speakingId, setSpeakingId] = useState<string | null>(null);
  const entriesRef = useRef(entries);
  const abortRef = useRef<AbortController | null>(null);
  const answersRef = useRef<HTMLElement>(null);

  useEffect(() => {
    entriesRef.current = entries;
  }, [entries]);

  const update = (id: string, patch: Partial<Entry>) =>
    setEntries((prev) => prev.map((e) => (e.id === id ? { ...e, ...patch } : e)));

  const readAloud = useCallback((entry: Pick<Entry, "id" | "answer">) => {
    setSpeakingId(entry.id);
    speak(entry.answer, () => setSpeakingId((cur) => (cur === entry.id ? null : cur)));
  }, []);

  const ask = useCallback(
    async (raw: string, viaVoice = false) => {
      const question = raw.trim();
      if (!question) return;

      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;
      stopSpeaking();
      setSpeakingId(null);
      setNotice("");
      setInput("");

      // Previous answered questions give context for follow-ups ("peki Lords'ta?").
      const history = entriesRef.current
        .filter((e) => e.state === "done")
        .slice(0, HISTORY_TURNS)
        .reverse()
        .flatMap((e) => [
          { role: "user", content: e.question },
          { role: "assistant", content: e.answer },
        ]);

      const id = crypto.randomUUID();
      setEntries((prev) => [{ id, question, answer: "", state: "streaming" as const }, ...prev].slice(0, MAX_ENTRIES));
      requestAnimationFrame(() => answersRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }));

      try {
        const res = await fetch("/api/ask", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ messages: [...history, { role: "user", content: question }] }),
          signal: controller.signal,
        });
        if (!res.ok || !res.body) {
          const data = (await res.json().catch(() => ({}))) as { error?: string };
          throw new Error(data.error ?? "Bir sorun oluştu. Lütfen tekrar deneyin.");
        }

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let text = "";
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          text += decoder.decode(value, { stream: true });
          const markerAt = text.indexOf(ERROR_MARKER);
          update(id, { answer: markerAt >= 0 ? text.slice(0, markerAt) : text });
        }

        const markerAt = text.indexOf(ERROR_MARKER);
        if (markerAt >= 0) throw new Error(text.slice(markerAt + ERROR_MARKER.length));
        const answer = text.trim();
        if (!answer) throw new Error("Cevap alınamadı. Lütfen tekrar deneyin.");

        update(id, { answer, state: "done" });
        if (viaVoice && getAutoRead()) readAloud({ id, answer });
      } catch (e) {
        if (controller.signal.aborted) return;
        update(id, {
          state: "error",
          error: e instanceof Error ? e.message : "Bir sorun oluştu. Lütfen tekrar deneyin.",
        });
      }
    },
    [readAloud],
  );

  const speech = useSpeechInput((text) => void ask(text, true), setNotice);

  const onMic = () => {
    setNotice("");
    stopSpeaking();
    setSpeakingId(null);
    unlockSpeech();
    speech.toggle();
  };

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    void ask(input);
  };

  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      void ask(input);
    }
  };

  const toggleAutoRead = (on: boolean) => {
    localStorage.setItem(AUTO_READ_KEY, on ? "1" : "0");
    autoReadListeners.forEach((listener) => listener());
  };

  const listening = speech.status === "listening";
  const transcribing = speech.status === "transcribing";
  const micLabel = listening ? "Dinlemeyi bitir" : "Sesli soru sor";
  const statusText = transcribing
    ? "Söyledikleriniz yazıya dökülüyor…"
    : listening
      ? "Dinliyorum… Bitince susmanız yeterli."
      : "Mikrofona dokunun ve sorunuzu söyleyin";

  return (
    <div className="page">
      <SiteNav />
      <header className="hero">
        <div className="terrain-strip" aria-hidden="true">
          {["grass", "canyon", "desert", "flower", "forest"].map((t) => (
            <span key={t} className={`hex hex-${t}`} />
          ))}
        </div>
        <p className="eyebrow" lang="en">
          Kingdom Builder
        </p>
        <h1>Kural Hakemi</h1>
        <p className="lede">Oyunda takıldığınız kuralı sorun, resmi kurallara göre net cevap alın.</p>
      </header>

      <main>
        <section className="ask-panel" aria-label="Soru sor">
          {speech.supported && (
            <div className="mic-area">
              <button
                type="button"
                className={`mic${listening ? " is-listening" : ""}${transcribing ? " is-busy" : ""}`}
                onClick={onMic}
                disabled={transcribing}
                aria-label={micLabel}
                aria-pressed={listening}
              >
                {transcribing ? <span className="spinner" aria-hidden="true" /> : <MicIcon listening={listening} />}
              </button>
              <p className="mic-status" aria-live="polite">
                {statusText}
              </p>
              {listening && speech.interim && <p className="interim">“{speech.interim}”</p>}
            </div>
          )}

          {notice && (
            <p className="notice" role="alert">
              {notice}
            </p>
          )}

          <form className="ask-form" onSubmit={onSubmit}>
            <label htmlFor="question" className="visually-hidden">
              Sorunuz
            </label>
            <textarea
              id="question"
              rows={2}
              maxLength={800}
              placeholder={speech.supported ? "…ya da buraya yazın" : "Sorunuzu buraya yazın"}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={onKeyDown}
              enterKeyHint="send"
            />
            <button type="submit" className="send" disabled={!input.trim()}>
              Sor
            </button>
          </form>

          <div className="chips" aria-label="Örnek sorular">
            {QUICK_QUESTIONS.map((q) => (
              <button key={q} type="button" className="chip" onClick={() => void ask(q)}>
                {q}
              </button>
            ))}
          </div>

          {ttsAvailable && (
            <label className="toggle">
              <input type="checkbox" checked={autoRead} onChange={(e) => toggleAutoRead(e.target.checked)} />
              <span>Sesli sorulara cevabı sesli de oku</span>
            </label>
          )}
        </section>

        {entries.length > 0 && (
          <section className="answers" ref={answersRef} aria-label="Cevaplar">
            {entries.map((entry, i) => (
              <article
                key={entry.id}
                className={`answer${i > 0 ? " is-old" : ""}`}
                aria-busy={entry.state === "streaming"}
              >
                <p className="answer-q">
                  <span className="tag">Soru</span>
                  {entry.question}
                </p>
                {entry.answer ? (
                  <div className="answer-body">
                    <Markdown>{entry.answer}</Markdown>
                    {entry.state === "streaming" && <span className="caret" aria-hidden="true" />}
                  </div>
                ) : (
                  entry.state === "streaming" && (
                    <p className="thinking">
                      <span className="dots" aria-hidden="true">
                        <i />
                        <i />
                        <i />
                      </span>
                      Kurallara bakılıyor…
                    </p>
                  )
                )}
                {entry.state === "error" && (
                  <div className="answer-error" role="alert">
                    <p>{entry.error}</p>
                    <button type="button" className="pill" onClick={() => void ask(entry.question)}>
                      Tekrar dene
                    </button>
                  </div>
                )}
                {entry.state === "done" && ttsAvailable && (
                  <div className="answer-actions">
                    {speakingId === entry.id ? (
                      <button
                        type="button"
                        className="pill"
                        onClick={() => {
                          stopSpeaking();
                          setSpeakingId(null);
                        }}
                      >
                        <SpeakerIcon /> Durdur
                      </button>
                    ) : (
                      <button type="button" className="pill" onClick={() => readAloud(entry)}>
                        <SpeakerIcon /> Sesli oku
                      </button>
                    )}
                  </div>
                )}
              </article>
            ))}
          </section>
        )}

        <CardGuide onAsk={(q) => void ask(q)} />
      </main>

      <footer className="footer">
        <p>
          Cevaplar Queen Games&apos;in resmi kural kitabına dayanır. Yapay zekâ nadiren yanılabilir; emin
          olamazsanız aşağıdaki kart rehberine bakın.
        </p>
      </footer>
    </div>
  );
}

function MicIcon({ listening }: { listening: boolean }) {
  if (listening) {
    return (
      <svg viewBox="0 0 24 24" width="44" height="44" aria-hidden="true">
        <rect x="6" y="6" width="12" height="12" rx="2.5" fill="currentColor" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 24 24" width="52" height="52" aria-hidden="true">
      <rect x="9" y="2.5" width="6" height="12" rx="3" fill="currentColor" />
      <path
        d="M5.5 11a6.5 6.5 0 0 0 13 0M12 17.5V21m-3.5 0h7"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  );
}

function SpeakerIcon() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
      <path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z" fill="currentColor" />
      <path
        d="M15.5 9a4 4 0 0 1 0 6M18 6.5a7.5 7.5 0 0 1 0 11"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  );
}
