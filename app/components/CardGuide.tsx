"use client";

import type { CSSProperties } from "react";
import { KINGDOM_BUILDER_CARDS, LOCATION_TILES, type GuideItem } from "@/lib/cards";
import { useI18n } from "./i18n";

export function CardGuide({ onAsk }: { onAsk: (question: string) => void }) {
  const { t } = useI18n();
  return (
    <section className="guide area-guide" aria-labelledby="guide-title">
      <h2 id="guide-title">{t.guide.title}</h2>
      <p className="guide-lede">{t.guide.lede}</p>

      <h3 lang="en">{t.guide.cardsHeading}</h3>
      <GuideList items={KINGDOM_BUILDER_CARDS} onAsk={onAsk} />

      <h3>{t.guide.tilesHeading}</h3>
      <p className="guide-hint">{t.guide.tilesHint}</p>
      <GuideList items={LOCATION_TILES} onAsk={onAsk} />
    </section>
  );
}

function GuideList({ items, onAsk }: { items: GuideItem[]; onAsk: (question: string) => void }) {
  const { lang, t } = useI18n();
  return (
    <div className="guide-list">
      {items.map((item) => {
        const text = item[lang];
        return (
          <details
            key={item.name}
            name="guide"
            className="guide-item"
            style={{ "--accent": item.accent } as CSSProperties}
          >
            <summary>
              <span className="badge" aria-hidden="true" />
              <span className="guide-name" lang="en">
                {item.name}
              </span>
              <span className="guide-goal">{text.goal}</span>
            </summary>
            <div className="guide-body">
              <p className="guide-scoring">{text.scoring}</p>
              {text.notes.length > 0 && (
                <ul>
                  {text.notes.map((n) => (
                    <li key={n}>{n}</li>
                  ))}
                </ul>
              )}
              <button type="button" className="pill" onClick={() => onAsk(text.ask)}>
                {t.guide.askMore}
              </button>
            </div>
          </details>
        );
      })}
    </div>
  );
}
