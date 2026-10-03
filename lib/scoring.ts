// End-of-game score calculator: each Kingdom Builder card needs only one or two numbers
// that players count on the board; the app does the multiplication.
import type { Lang } from "./i18n";

export type ScoreField = {
  key: string;
  label: Record<Lang, string>;
  /** Shown next to the input, e.g. "× 2". */
  rate: string;
  max: number;
  gold: (count: number) => number;
};

export type ScoreRule = { id: string; fields: ScoreField[]; hint?: Record<Lang, string> };

const times = (key: string, label: Record<Lang, string>, multiplier: number, max = 40): ScoreField => ({
  key,
  label,
  rate: `× ${multiplier}`,
  max,
  gold: (n) => n * multiplier,
});

export const CARD_RULES: Record<string, ScoreRule> = {
  Farmers: {
    id: "Farmers",
    fields: [times("n", { tr: "En az evin olan çeyrekteki ev", en: "Houses in your weakest sector" }, 3)],
    hint: { tr: "Bir çeyrekte hiç evin yoksa 0 yaz.", en: "Enter 0 if a sector has none of your houses." },
  },
  Knights: {
    id: "Knights",
    fields: [times("n", { tr: "En dolu yatay sıradaki ev", en: "Houses on your fullest row" }, 2)],
  },
  Lords: {
    id: "Lords",
    fields: [
      times("first", { tr: "1. olduğun çeyrek sayısı", en: "Sectors where you're 1st" }, 12, 4),
      times("second", { tr: "2. olduğun çeyrek sayısı", en: "Sectors where you're 2nd" }, 6, 4),
    ],
    hint: { tr: "Beraberlikte hepiniz o sıranın puanını alırsınız.", en: "Ties: everyone tied gets that place's gold." },
  },
  Fishermen: {
    id: "Fishermen",
    fields: [times("n", { tr: "Suya komşu ev", en: "Houses next to water" }, 1)],
  },
  Miners: {
    id: "Miners",
    fields: [times("n", { tr: "Dağa komşu ev", en: "Houses next to mountains" }, 1)],
  },
  Workers: {
    id: "Workers",
    fields: [times("n", { tr: "Lokasyona ya da kaleye komşu ev", en: "Houses next to a location or castle" }, 1)],
  },
  Discoverers: {
    id: "Discoverers",
    fields: [times("n", { tr: "Evin olan yatay sıra", en: "Rows with your houses" }, 1, 20)],
  },
  Hermits: {
    id: "Hermits",
    fields: [times("n", { tr: "Ayrı ev grubu (tek ev de sayılır)", en: "Separate house groups (single houses count)" }, 1)],
  },
  Citizens: {
    id: "Citizens",
    fields: [
      {
        key: "n",
        label: { tr: "En büyük gruptaki ev", en: "Houses in your largest group" },
        rate: "÷ 2",
        max: 40,
        gold: (n) => Math.floor(n / 2),
      },
    ],
  },
  Merchants: {
    id: "Merchants",
    fields: [times("n", { tr: "Birbirine bağladığın lokasyon/kale", en: "Locations/castles you linked together" }, 4, 20)],
  },
};

export const CASTLE_RULE: ScoreRule = {
  id: "castles",
  fields: [times("n", { tr: "Yanında evin olan kale", en: "Castles next to your houses" }, 3, 10)],
};

/** counts[playerId][ruleId.fieldKey] = typed value ("" counts as 0). */
export type Counts = Record<string, Record<string, string>>;

export const fieldId = (rule: ScoreRule, field: ScoreField) => `${rule.id}.${field.key}`;

export function fieldValue(raw: string | undefined, field: ScoreField): number {
  const n = Number(raw);
  return raw && Number.isInteger(n) && n >= 0 ? Math.min(n, field.max) : 0;
}

export function ruleGold(rule: ScoreRule, values: Record<string, string> | undefined): number {
  return rule.fields.reduce((sum, f) => sum + f.gold(fieldValue(values?.[fieldId(rule, f)], f)), 0);
}

export function rulesFor(cards: string[]): ScoreRule[] {
  return [...cards.flatMap((c) => (CARD_RULES[c] ? [CARD_RULES[c]] : [])), CASTLE_RULE];
}

export function playerTotal(cards: string[], values: Record<string, string> | undefined): number {
  return rulesFor(cards).reduce((sum, rule) => sum + ruleGold(rule, values), 0);
}
