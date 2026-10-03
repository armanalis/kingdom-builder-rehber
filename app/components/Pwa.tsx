"use client";

import { useEffect, useSyncExternalStore } from "react";
import { useI18n } from "./i18n";

const RUNTIME_CACHE = "kb-runtime-v1"; // must match public/sw.js

/** Registers the service worker so the installed app also opens without internet. */
export function ServiceWorker() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production" || !("serviceWorker" in navigator)) return;
    navigator.serviceWorker
      .register("/sw.js")
      .then(() => navigator.serviceWorker.ready)
      .then(async () => {
        // Files loaded before the worker took over (first visit) are cached here,
        // so the next offline start has everything it needs.
        const urls = performance
          .getEntriesByType("resource")
          .map((e) => new URL(e.name))
          .filter((u) => u.origin === location.origin && /^\/(_next\/static|components)\//.test(u.pathname))
          .map((u) => u.href);
        const cache = await caches.open(RUNTIME_CACHE);
        await Promise.all(
          urls.map(async (url) => {
            if (!(await cache.match(url))) await cache.add(url).catch(() => {});
          }),
        );
      })
      .catch(() => {});
  }, []);
  return null;
}

const DISMISS_KEY = "kb-install-hint-dismissed";
const listeners = new Set<() => void>();
const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};

type Platform = "ios" | "android" | null;

function hintPlatform(): Platform {
  if (localStorage.getItem(DISMISS_KEY) === "1") return null;
  const standalone =
    window.matchMedia("(display-mode: standalone)").matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true;
  if (standalone) return null;
  const ua = navigator.userAgent;
  if (/iPhone|iPad|iPod/.test(ua)) return "ios";
  if (/Android/.test(ua)) return "android";
  return null;
}

/** Short "add to home screen" tip for phones (browsers don't offer one button for this everywhere). */
export function InstallHint() {
  const { t } = useI18n();
  const platform = useSyncExternalStore(subscribe, hintPlatform, () => null);
  if (!platform) return null;
  return (
    <aside className="install-hint">
      <span className="install-icon" aria-hidden="true">
        📱
      </span>
      <div>
        <p className="install-title">{t.install.title}</p>
        <p>{platform === "ios" ? t.install.ios : t.install.android}</p>
      </div>
      <button
        type="button"
        className="photo-remove"
        aria-label={t.install.dismiss}
        onClick={() => {
          localStorage.setItem(DISMISS_KEY, "1");
          listeners.forEach((l) => l());
        }}
      >
        ×
      </button>
    </aside>
  );
}
