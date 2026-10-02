"use client";

import { useEffect, useState, useSyncExternalStore, type CSSProperties, type FormEvent, type ReactNode } from "react";
import { errorText } from "@/lib/i18n";
import { MAX_PLAYERS, MIN_PLAYERS, needsSetup, PLAYER_COLORS, type Scoreboard } from "@/lib/scoreboard";
import { errorCodeOf, fetchScoreboard, sendMutation } from "@/lib/scoresClient";
import { LanguageSwitch, useI18n } from "./i18n";

const STORAGE_KEY = "kb-onboarded";
const listeners = new Set<() => void>();
const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};
const isOnboarded = () => localStorage.getItem(STORAGE_KEY) === "1";

function finishOnboarding() {
  localStorage.setItem(STORAGE_KEY, "1");
  listeners.forEach((l) => l());
  window.scrollTo(0, 0);
}

/** Shows the welcome screen on a device's first visit, the app afterwards. */
export function OnboardingGate({ children }: { children: ReactNode }) {
  const onboarded = useSyncExternalStore(subscribe, isOnboarded, () => true);
  return onboarded ? children : <Onboarding />;
}

function Onboarding() {
  const { t } = useI18n();
  const [board, setBoard] = useState<Scoreboard | null>(null);
  const [offline, setOffline] = useState(false);

  useEffect(() => {
    fetchScoreboard().then(setBoard, () => setOffline(true));
  }, []);

  return (
    <div className="page onboarding">
      <div className="topbar">
        <LanguageSwitch />
      </div>
      <header className="hero">
        <div className="terrain-strip" aria-hidden="true">
          {["grass", "canyon", "desert", "flower", "forest"].map((x) => (
            <span key={x} className={`hex hex-${x}`} />
          ))}
        </div>
        <p className="eyebrow" lang="en">
          Kingdom Builder
        </p>
        <h1>{t.onboarding.title}</h1>
        <p className="lede">{t.onboarding.intro}</p>
        <ul className="features">
          {t.onboarding.features.map((f) => (
            <li key={f}>{f}</li>
          ))}
        </ul>
      </header>

      <main>
        {!board && !offline && <p className="loading">{t.scores.loading}</p>}

        {board && needsSetup(board) && (
          <section className="panel" aria-labelledby="setup-title">
            <PlayerSetupForm onDone={finishOnboarding} />
          </section>
        )}

        {(offline || (board && !needsSetup(board))) && (
          <section className="panel onboarding-ready">
            {board ? (
              <>
                <p className="onboarding-label">{t.onboarding.existing}</p>
                <ul className="player-pills">
                  {board.players.map((p) => (
                    <li key={p.id} style={{ "--player": p.color } as CSSProperties}>
                      <span className="dot" aria-hidden="true" /> {p.name}
                    </li>
                  ))}
                </ul>
                <p className="setup-lede">{t.onboarding.existingHint}</p>
              </>
            ) : (
              <p className="setup-lede">{t.onboarding.offline}</p>
            )}
            <button type="button" className="send send-wide" onClick={finishOnboarding}>
              {t.onboarding.start}
            </button>
          </section>
        )}
      </main>
    </div>
  );
}

/** Enter 2–5 player names; used on first visit and on the scoreboard if setup is missing. */
export function PlayerSetupForm({ onDone }: { onDone: (board: Scoreboard) => void }) {
  const { t } = useI18n();
  const [names, setNames] = useState(["", ""]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const ready = names.every((n) => n.trim());

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!ready || saving) return;
    setSaving(true);
    setError("");
    try {
      onDone(await sendMutation({ type: "setupPlayers", names }));
    } catch (err) {
      setError(errorText(t, errorCodeOf(err)));
      setSaving(false);
    }
  };

  return (
    <>
      <h2 id="setup-title" className="panel-title">
        {t.setup.title}
      </h2>
      <p className="setup-lede">{t.setup.lede}</p>
      <form onSubmit={onSubmit}>
        {names.map((value, i) => (
          <div key={i} className="setup-field" style={{ "--player": PLAYER_COLORS[i] } as CSSProperties}>
            <label htmlFor={`setup-name-${i}`}>
              <span className="dot" aria-hidden="true" /> {t.setup.player(i + 1)}
            </label>
            <div className="setup-input-row">
              <input
                id={`setup-name-${i}`}
                value={value}
                maxLength={24}
                autoComplete="off"
                autoCapitalize="words"
                enterKeyHint={i === names.length - 1 ? "done" : "next"}
                placeholder={t.setup.placeholders[i]}
                onChange={(e) => setNames((prev) => prev.map((n, j) => (j === i ? e.target.value : n)))}
              />
              {names.length > MIN_PLAYERS && (
                <button
                  type="button"
                  className="remove-row"
                  aria-label={t.setup.removeRow(i + 1)}
                  onClick={() => setNames((prev) => prev.filter((_, j) => j !== i))}
                >
                  ×
                </button>
              )}
            </div>
          </div>
        ))}
        {names.length < MAX_PLAYERS && (
          <button type="button" className="pill" onClick={() => setNames((prev) => [...prev, ""])}>
            {t.setup.addRow}
          </button>
        )}
        {error && (
          <p className="notice" role="alert">
            {error}
          </p>
        )}
        <button type="submit" className="send send-wide" disabled={!ready || saving}>
          {saving ? t.setup.saving : t.setup.start}
        </button>
      </form>
    </>
  );
}
