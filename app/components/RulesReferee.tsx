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
import { errorText, MESSAGES, type ErrorCode, type Lang } from "@/lib/i18n";
import { mentionedComponents } from "@/lib/cards";
import { CardGuide, ComponentImage } from "./CardGuide";
import { useI18n } from "./i18n";
import { SiteNav } from "./SiteNav";
import { preparePhoto, type Photo } from "./photo";
import { canSpeak, speak, stopSpeaking, unlockSpeech } from "./speak";
import { useSpeechInput } from "./useSpeechInput";

type Entry = {
  id: string;
  question: string;
  /** Photo sent with the question (small data URL), shown above the answer. */
  photoUrl?: string;
  answer: string;
  lang: Lang;
  state: "streaming" | "done" | "error";
  error?: ErrorCode;
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

class AskError extends Error {
  constructor(public code: ErrorCode) {
    super(code);
  }
}

export function RulesReferee() {
  const { lang, t } = useI18n();
  const [entries, setEntries] = useState<Entry[]>([]);
  const [input, setInput] = useState("");
  const [notice, setNotice] = useState<ErrorCode | null>(null);
  const autoRead = useSyncExternalStore(subscribeAutoRead, getAutoRead, () => true);
  const ttsAvailable = useSyncExternalStore(subscribeNever, canSpeak, () => false);
  const [speakingId, setSpeakingId] = useState<string | null>(null);
  const [photo, setPhoto] = useState<Photo | null>(null);
  const photoRef = useRef<Photo | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const entriesRef = useRef(entries);
  const abortRef = useRef<AbortController | null>(null);
  const answersRef = useRef<HTMLElement>(null);

  useEffect(() => {
    entriesRef.current = entries;
  }, [entries]);

  useEffect(() => {
    photoRef.current = photo;
  }, [photo]);

  const onPhotoPicked = async (file: File | undefined) => {
    if (!file) return;
    setNotice(null);
    try {
      setPhoto(await preparePhoto(file));
    } catch {
      setNotice("photo_failed");
    }
  };

  const update = (id: string, patch: Partial<Entry>) =>
    setEntries((prev) => prev.map((e) => (e.id === id ? { ...e, ...patch } : e)));

  const readAloud = useCallback((entry: Pick<Entry, "id" | "answer" | "lang">) => {
    setSpeakingId(entry.id);
    speak(entry.answer, entry.lang, () => setSpeakingId((cur) => (cur === entry.id ? null : cur)));
  }, []);

  const ask = useCallback(
    async (raw: string, viaVoice = false) => {
      const attached = photoRef.current;
      const question = raw.trim() || (attached ? MESSAGES[lang].rules.photoQuestion : "");
      if (!question) return;
      setPhoto(null);
      photoRef.current = null;

      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;
      stopSpeaking();
      setSpeakingId(null);
      setNotice(null);
      setInput("");

      // Previous answered questions give context for follow-ups ("and for Lords?").
      const history = entriesRef.current
        .filter((e) => e.state === "done")
        .slice(0, HISTORY_TURNS)
        .reverse()
        .flatMap((e) => [
          { role: "user", content: e.question },
          { role: "assistant", content: e.answer },
        ]);

      const id = crypto.randomUUID();
      setEntries((prev) =>
        [
          { id, question, photoUrl: attached?.dataUrl, answer: "", lang, state: "streaming" as const },
          ...prev,
        ].slice(0, MAX_ENTRIES),
      );
      requestAnimationFrame(() => answersRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }));

      try {
        const res = await fetch("/api/ask", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            lang,
            messages: [...history, { role: "user", content: question }],
            photo: attached ? { data: attached.base64, mediaType: attached.mediaType } : undefined,
          }),
          signal: controller.signal,
        });
        if (!res.ok || !res.body) {
          const data = (await res.json().catch(() => ({}))) as { error?: ErrorCode };
          throw new AskError(data.error ?? "generic");
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
        if (markerAt >= 0) throw new AskError(text.slice(markerAt + ERROR_MARKER.length) as ErrorCode);
        const answer = text.trim();
        if (!answer) throw new AskError("empty_answer");

        update(id, { answer, state: "done" });
        if (viaVoice && getAutoRead()) readAloud({ id, answer, lang });
      } catch (e) {
        if (controller.signal.aborted) return;
        update(id, { state: "error", error: e instanceof AskError ? e.code : "generic" });
      }
    },
    [lang, readAloud],
  );

  const speech = useSpeechInput(lang, (text) => void ask(text, true), setNotice);

  const onMic = () => {
    setNotice(null);
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

  const r = t.rules;
  const listening = speech.status === "listening";
  const transcribing = speech.status === "transcribing";
  const statusText = transcribing ? r.statusTranscribing : listening ? r.statusListening : r.statusIdle;

  return (
    <div className="page page-rules">
      <SiteNav />
      <header className="hero">
        <div className="terrain-strip" aria-hidden="true">
          {["grass", "canyon", "desert", "flower", "forest"].map((x) => (
            <span key={x} className={`hex hex-${x}`} />
          ))}
        </div>
        <p className="eyebrow" lang="en">
          Kingdom Builder
        </p>
        <h1>{r.title}</h1>
        <p className="lede">{r.lede}</p>
      </header>

      <main className="rules-main">
        <section className="ask-panel area-ask" aria-label={r.askAria}>
          {speech.supported && (
            <div className="mic-area">
              <button
                type="button"
                className={`mic${listening ? " is-listening" : ""}${transcribing ? " is-busy" : ""}`}
                onClick={onMic}
                disabled={transcribing}
                aria-label={listening ? r.micStop : r.micStart}
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
              {errorText(t, notice)}
            </p>
          )}

          <form className="ask-form" onSubmit={onSubmit}>
            <button
              type="button"
              className="photo-btn"
              aria-label={r.addPhoto}
              title={r.addPhoto}
              onClick={() => fileInputRef.current?.click()}
            >
              <CameraIcon />
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              hidden
              onChange={(e) => {
                void onPhotoPicked(e.target.files?.[0]);
                e.target.value = "";
              }}
            />
            <label htmlFor="question" className="visually-hidden">
              {r.inputLabel}
            </label>
            <textarea
              id="question"
              rows={2}
              maxLength={800}
              placeholder={speech.supported ? r.placeholderWithMic : r.placeholderNoMic}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={onKeyDown}
              enterKeyHint="send"
            />
            <button type="submit" className="send" disabled={!input.trim() && !photo}>
              {r.send}
            </button>
          </form>

          {photo && (
            <div className="photo-preview">
              {/* eslint-disable-next-line @next/next/no-img-element -- local data URL preview */}
              <img src={photo.dataUrl} alt={r.photoAlt} />
              <p>{r.photoReady}</p>
              <button type="button" className="photo-remove" aria-label={r.removePhoto} onClick={() => setPhoto(null)}>
                ×
              </button>
            </div>
          )}

          <div className="chips" aria-label={r.examplesAria}>
            {r.quickQuestions.map((q) => (
              <button key={q} type="button" className="chip" onClick={() => void ask(q)}>
                {q}
              </button>
            ))}
          </div>

          {ttsAvailable && (
            <label className="toggle">
              <input type="checkbox" checked={autoRead} onChange={(e) => toggleAutoRead(e.target.checked)} />
              <span>{r.autoRead}</span>
            </label>
          )}
        </section>

        {entries.length > 0 && (
          <section className="answers area-answers" ref={answersRef} aria-label={r.answersAria}>
            {entries.map((entry, i) => (
              <article
                key={entry.id}
                className={`answer${i > 0 ? " is-old" : ""}`}
                aria-busy={entry.state === "streaming"}
              >
                <p className="answer-q">
                  <span className="tag">{r.questionTag}</span>
                  {entry.question}
                </p>
                {entry.photoUrl && (
                  // eslint-disable-next-line @next/next/no-img-element -- local data URL of the user's photo
                  <img className="answer-photo" src={entry.photoUrl} alt={r.photoAlt} />
                )}
                {entry.answer ? (
                  <div className="answer-body" lang={entry.lang}>
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
                      {r.thinking}
                    </p>
                  )
                )}
                {entry.state === "done" && <Mentions text={`${entry.question}\n${entry.answer}`} />}
                {entry.state === "error" && (
                  <div className="answer-error" role="alert">
                    <p>{errorText(t, entry.error)}</p>
                    <button type="button" className="pill" onClick={() => void ask(entry.question)}>
                      {r.retry}
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
                        <SpeakerIcon /> {r.stop}
                      </button>
                    ) : (
                      <button type="button" className="pill" onClick={() => readAloud(entry)}>
                        <SpeakerIcon /> {r.readAloud}
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
        <p>{r.footer}</p>
      </footer>
    </div>
  );
}

/** Pictures of the cards and tiles an answer talks about, so players can match them to the table. */
function Mentions({ text }: { text: string }) {
  const { lang, t } = useI18n();
  const items = mentionedComponents(text);
  if (items.length === 0) return null;
  return (
    <div className="mentions">
      <p className="mentions-label">{t.rules.mentions}</p>
      <ul>
        {items.map((item) => (
          <li key={item.name}>
            <ComponentImage item={item} size="mini" />
            <span>
              <span className="mention-name" lang="en">
                {item.name}
              </span>
              {lang === "tr" && <span className="mention-tr">{item.trName}</span>}
            </span>
          </li>
        ))}
      </ul>
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

function CameraIcon() {
  return (
    <svg viewBox="0 0 24 24" width="26" height="26" aria-hidden="true">
      <path
        d="M4 8.5A2.5 2.5 0 0 1 6.5 6h1.6l1.2-1.8c.3-.4.8-.7 1.3-.7h2.8c.5 0 1 .3 1.3.7L15.9 6h1.6A2.5 2.5 0 0 1 20 8.5v8a2.5 2.5 0 0 1-2.5 2.5h-11A2.5 2.5 0 0 1 4 16.5z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
      />
      <circle cx="12" cy="12.5" r="3.4" fill="none" stroke="currentColor" strokeWidth="1.8" />
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
