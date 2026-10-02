"use client";

import Image from "next/image";
import { KINGDOM_BUILDER_CARDS, LOCATION_TILES, type GuideItem } from "@/lib/cards";
import { useI18n } from "./i18n";

export function CardGuide({ onAsk }: { onAsk: (question: string) => void }) {
  const { t } = useI18n();
  return (
    <section className="guide area-guide" aria-labelledby="guide-title">
      <h2 id="guide-title">{t.guide.title}</h2>
      <p className="guide-lede">{t.guide.lede}</p>

      <h3 lang="en">{t.guide.cardsHeading}</h3>
      <GuideList items={KINGDOM_BUILDER_CARDS} kind="card" onAsk={onAsk} />

      <h3>{t.guide.tilesHeading}</h3>
      <p className="guide-hint">{t.guide.tilesHint}</p>
      <GuideList items={LOCATION_TILES} kind="tile" onAsk={onAsk} />
    </section>
  );
}

/** Picture of a card or tile as printed in the rulebook. */
export function ComponentImage({ item, size }: { item: GuideItem; size: "thumb" | "large" | "mini" }) {
  const tile = item.image.includes("/tile-");
  const width = { thumb: tile ? 54 : 50, large: tile ? 120 : 150, mini: tile ? 46 : 42 }[size];
  const height = Math.round(width * (tile ? 200 / 175 : 460 / 298));
  return (
    <Image
      src={item.image}
      alt=""
      width={width}
      height={height}
      unoptimized
      className={`component-img ${tile ? "is-tile" : "is-card"} is-${size}`}
    />
  );
}

function GuideList({ items, kind, onAsk }: { items: GuideItem[]; kind: "card" | "tile"; onAsk: (q: string) => void }) {
  const { lang, t } = useI18n();
  return (
    <div className={`guide-list guide-list-${kind}`}>
      {items.map((item) => {
        const text = item[lang];
        return (
          <details key={item.name} name="guide" className="guide-item">
            <summary>
              <ComponentImage item={item} size="thumb" />
              <span className="guide-title">
                <span className="guide-name" lang="en">
                  {item.name}
                </span>
                {lang === "tr" && <span className="guide-trname">{item.trName}</span>}
              </span>
              <span className="guide-goal">{text.goal}</span>
            </summary>
            <div className="guide-body">
              <ComponentImage item={item} size="large" />
              <div>
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
            </div>
          </details>
        );
      })}
    </div>
  );
}
