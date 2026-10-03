"use client";

import type { CSSProperties } from "react";
import { COLOR_IDS, PLAYER_COLORS } from "@/lib/scoreboard";
import { useI18n } from "./i18n";

const WHITE = PLAYER_COLORS[3];

/** CSS variables for a player's color; white gets a visible edge on the light background. */
export function playerStyle(color: string): CSSProperties {
  return { "--player": color, "--player-line": color === WHITE ? "#c9bea9" : color } as CSSProperties;
}

/** The four settlement colors; the selected one is marked. */
export function ColorPicker({
  value,
  onChange,
  label,
}: {
  value: string;
  onChange: (color: string) => void;
  label: string;
}) {
  const { t } = useI18n();
  return (
    <div className="color-picker" role="group" aria-label={label}>
      {PLAYER_COLORS.map((color, i) => (
        <button
          key={color}
          type="button"
          className="color-swatch"
          style={playerStyle(color)}
          aria-pressed={value === color}
          aria-label={t.colors[COLOR_IDS[i]]}
          title={t.colors[COLOR_IDS[i]]}
          onClick={() => onChange(color)}
        />
      ))}
    </div>
  );
}
