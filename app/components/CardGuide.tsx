"use client";

import type { CSSProperties } from "react";
import { KINGDOM_BUILDER_CARDS, LOCATION_TILES, type GuideItem } from "@/lib/cards";

export function CardGuide({ onAsk }: { onAsk: (question: string) => void }) {
  return (
    <section className="guide" aria-labelledby="guide-title">
      <h2 id="guide-title">Hızlı kart rehberi</h2>
      <p className="guide-lede">Yapay zekâya gerek kalmadan: karta dokunun, özetini görün.</p>

      <h3 lang="en">Kingdom Builder kartları</h3>
      <GuideList items={KINGDOM_BUILDER_CARDS} onAsk={onAsk} />

      <h3>Lokasyon karoları (ekstra hamleler)</h3>
      <p className="guide-hint">
        Her karo kendi turunda bir kez, zorunlu 3 yerleşimden önce ya da sonra kullanılır. Yeni alınan karo
        ancak bir sonraki turda kullanılabilir.
      </p>
      <GuideList items={LOCATION_TILES} onAsk={onAsk} />
    </section>
  );
}

function GuideList({ items, onAsk }: { items: GuideItem[]; onAsk: (question: string) => void }) {
  return (
    <div className="guide-list">
      {items.map((item) => (
        <details key={item.name} name="guide" className="guide-item" style={{ "--accent": item.accent } as CSSProperties}>
          <summary>
            <span className="badge" aria-hidden="true" />
            <span className="guide-name">{item.name}</span>
            <span className="guide-goal">{item.goal}</span>
          </summary>
          <div className="guide-body">
            <p className="guide-scoring">{item.scoring}</p>
            {item.notes.length > 0 && (
              <ul>
                {item.notes.map((n) => (
                  <li key={n}>{n}</li>
                ))}
              </ul>
            )}
            <button type="button" className="pill" onClick={() => onAsk(item.ask)}>
              Daha fazlasını sor
            </button>
          </div>
        </details>
      ))}
    </div>
  );
}
