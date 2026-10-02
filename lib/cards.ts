// Static quick-reference shown in the UI (no AI needed).
// Names stay in English (as printed on the components); explanations in both languages.
import type { Lang } from "./i18n";

type GuideText = { goal: string; scoring: string; notes: string[]; ask: string };

export type GuideItem = {
  name: string;
  /** Name in the Turkish edition (Neotroy), shown next to the English name. */
  trName: string;
  image: string;
} & Record<Lang, GuideText>;

export const KINGDOM_BUILDER_CARDS: GuideItem[] = [
  {
    name: "Farmers",
    trName: "Çiftçiler",
    image: "/components/card-farmers.webp",
    tr: {
      goal: "Her çeyreğe yerleşim kur.",
      scoring: "En az yerleşimin olan çeyrekteki her yerleşimin için 3 altın.",
      notes: [
        "Her oyuncu kendi için bakar: 4 çeyrekteki yerleşim sayılarından en küçüğü × 3.",
        "Çeyrekteki toplam sayı önemli, bağlı olmaları gerekmez.",
        "Bir çeyrekte hiç yerleşimin yoksa 0 altın.",
        "Örnek: 10, 6, 6, 4 → 4 × 3 = 12 altın.",
      ],
      ask: "Farmers kartı nasıl puanlanır?",
    },
    en: {
      goal: "Build settlements in every sector.",
      scoring: "3 gold for each of your settlements in the sector where you have the fewest.",
      notes: [
        "Each player checks their own: the smallest of your 4 sector counts × 3.",
        "The total count in the sector matters; they don't need to be connected.",
        "If you have no settlement in some sector, you get 0.",
        "Example: 10, 6, 6, 4 → 4 × 3 = 12 gold.",
      ],
      ask: "How is the Farmers card scored?",
    },
  },
  {
    name: "Lords",
    trName: "Derebeyleri",
    image: "/components/card-lords.webp",
    tr: {
      goal: "Her çeyrekte en çok yerleşime sahip ol.",
      scoring: "Her çeyrek ayrı: en çok yerleşimi olan 12 altın, ikinci en çok olan 6 altın.",
      notes: [
        "Sadece sayı önemli, bağlı olmaları gerekmez.",
        "Birincilikte beraberlik: hepsi 12 alır, sonraki sayı yine 6 alır (8, 8, 6, 2 → 12, 12, 6, 0).",
        "İkincilikte beraberlik: hepsi 6 alır.",
      ],
      ask: "Lords kartında beraberlik olursa ne olur?",
    },
    en: {
      goal: "Have the most settlements in each sector.",
      scoring: "Each sector separately: most settlements 12 gold, second most 6 gold.",
      notes: [
        "Only the number counts; they don't need to be connected.",
        "Tie for first: all get 12, and the next count still gets 6 (8, 8, 6, 2 → 12, 12, 6, 0).",
        "Tie for second: all get 6.",
      ],
      ask: "What happens with a tie on the Lords card?",
    },
  },
  {
    name: "Knights",
    trName: "Şövalyeler",
    image: "/components/card-knights.webp",
    tr: {
      goal: "Tek bir yatay sırada çok yerleşim kur.",
      scoring: "En çok yerleşimin olan yatay sıradaki her yerleşimin için 2 altın.",
      notes: [
        "Sadece en iyi TEK sıra sayılır.",
        "Sıra tüm haritayı yatay boydan boya geçer; yerleşimlerin yan yana olması gerekmez.",
      ],
      ask: "Knights kartında hangi sıra sayılır?",
    },
    en: {
      goal: "Build many settlements on one horizontal row.",
      scoring: "2 gold for each of your settlements on the row where you have the most.",
      notes: [
        "Only your single best row counts.",
        "A row runs across the whole board; the settlements don't need to touch.",
      ],
      ask: "Which row counts for the Knights card?",
    },
  },
  {
    name: "Discoverers",
    trName: "Kaşifler",
    image: "/components/card-discoverers.webp",
    tr: {
      goal: "Mümkün olduğunca çok yatay sırada yerleşim kur.",
      scoring: "En az bir yerleşimin olan her yatay sıra için 1 altın.",
      notes: ["Haritada 20 yatay sıra var, en fazla 20 altın."],
      ask: "Discoverers kartı nasıl sayılır?",
    },
    en: {
      goal: "Build on as many horizontal rows as possible.",
      scoring: "1 gold for each row with at least one of your settlements.",
      notes: ["The board has 20 rows, so at most 20 gold."],
      ask: "How is the Discoverers card counted?",
    },
  },
  {
    name: "Merchants",
    trName: "Tüccarlar",
    image: "/components/card-merchants.webp",
    tr: {
      goal: "Lokasyon ve kaleleri kendi yerleşimlerinle birbirine bağla.",
      scoring:
        "Yerleşim zincirinle başka bir lokasyon/kaleye bağlanan her lokasyon veya kale için 4 altın.",
      notes: [
        "3 lokasyonu bağlayan tek zincir = 12 altın.",
        "Hiçbir yere bağlanmayan lokasyon = 0.",
        "Karosu bitmiş lokasyonlar da sayılır.",
      ],
      ask: "Merchants kartında bağlantı nasıl sayılır?",
    },
    en: {
      goal: "Connect locations and castles with your settlements.",
      scoring:
        "4 gold for each location or castle linked by a chain of your settlements to another location or castle.",
      notes: [
        "One chain linking 3 locations = 12 gold.",
        "A location not linked to anything = 0.",
        "Locations with no tiles left still count.",
      ],
      ask: "How are connections counted for the Merchants card?",
    },
  },
  {
    name: "Citizens",
    trName: "Şehirliler",
    image: "/components/card-citizens.webp",
    tr: {
      goal: "Büyük tek bir yerleşim alanı oluştur.",
      scoring: "En büyük bağlı yerleşim grubundaki her 2 yerleşim için 1 altın.",
      notes: ["Sadece en büyük grup sayılır, aşağı yuvarlanır (9 → 4 altın)."],
      ask: "Citizens kartında hangi grup sayılır?",
    },
    en: {
      goal: "Build one large settlement area.",
      scoring: "1 gold for every 2 settlements in your largest connected group.",
      notes: ["Only your largest group counts, rounded down (9 → 4 gold)."],
      ask: "Which group counts for the Citizens card?",
    },
  },
  {
    name: "Hermits",
    trName: "Münzeviler",
    image: "/components/card-hermits.webp",
    tr: {
      goal: "Çok sayıda ayrı yerleşim alanı oluştur.",
      scoring: "Birbirinden ayrı her yerleşim grubu için 1 altın.",
      notes: ["Tek başına duran bir yerleşim de bir grup sayılır."],
      ask: "Hermits kartında tek yerleşim grup sayılır mı?",
    },
    en: {
      goal: "Create many separate settlement areas.",
      scoring: "1 gold for each separate group of your settlements.",
      notes: ["A single settlement on its own also counts as a group."],
      ask: "Does a single settlement count as a group for Hermits?",
    },
  },
  {
    name: "Fishermen",
    trName: "Balıkçılar",
    image: "/components/card-fishermen.webp",
    tr: {
      goal: "Su kenarına yerleşim kur.",
      scoring: "En az bir su hex'ine komşu olan her yerleşimin için 1 altın.",
      notes: [
        "Her yerleşim en fazla 1 altın verir.",
        "Harbor ile suyun ÜSTÜNE konan yerleşimler altın vermez.",
      ],
      ask: "Fishermen kartında suyun üstündeki yerleşim sayılır mı?",
    },
    en: {
      goal: "Build next to water.",
      scoring: "1 gold for each settlement next to at least one water hex.",
      notes: [
        "Each settlement gives at most 1 gold.",
        "Settlements placed ON water with the Harbor give nothing.",
      ],
      ask: "Does a settlement on water count for Fishermen?",
    },
  },
  {
    name: "Miners",
    trName: "Madenciler",
    image: "/components/card-miners.webp",
    tr: {
      goal: "Dağ kenarına yerleşim kur.",
      scoring: "En az bir dağ hex'ine komşu olan her yerleşimin için 1 altın.",
      notes: ["Her yerleşim en fazla 1 altın verir."],
      ask: "Miners kartı nasıl puanlanır?",
    },
    en: {
      goal: "Build next to mountains.",
      scoring: "1 gold for each settlement next to at least one mountain hex.",
      notes: ["Each settlement gives at most 1 gold."],
      ask: "How is the Miners card scored?",
    },
  },
  {
    name: "Workers",
    trName: "İşçiler",
    image: "/components/card-workers.webp",
    tr: {
      goal: "Lokasyon ve kalelerin yanına yerleşim kur.",
      scoring: "Bir lokasyona veya kaleye komşu olan her yerleşimin için 1 altın.",
      notes: ["İkisine birden komşu olsa da 1 altın; bağlantı gerekmez."],
      ask: "Workers kartı nasıl puanlanır?",
    },
    en: {
      goal: "Build next to locations and castles.",
      scoring: "1 gold for each settlement next to a location or castle.",
      notes: ["Still 1 gold if it touches both; no connection needed."],
      ask: "How is the Workers card scored?",
    },
  },
];

export const LOCATION_TILES: GuideItem[] = [
  {
    name: "Oracle",
    trName: "Mabet",
    image: "/components/tile-oracle.webp",
    tr: {
      goal: "Kartındaki araziye +1 yerleşim.",
      scoring: "Bu tur oynadığın arazi kartıyla aynı arazi türüne 1 yerleşim kur. Mümkünse komşu kur.",
      notes: [],
      ask: "Oracle karosu nasıl kullanılır?",
    },
    en: {
      goal: "+1 settlement on your card's terrain.",
      scoring: "Build 1 settlement on the terrain of the card you played this turn. Build adjacent if possible.",
      notes: [],
      ask: "How do I use the Oracle tile?",
    },
  },
  {
    name: "Farm",
    trName: "Çiftlik",
    image: "/components/tile-farm.webp",
    tr: {
      goal: "Grass'a +1 yerleşim.",
      scoring: "Grass (çimen) hex'ine 1 yerleşim kur. Mümkünse komşu kur.",
      notes: [],
      ask: "Farm karosu nasıl kullanılır?",
    },
    en: {
      goal: "+1 settlement on Grass.",
      scoring: "Build 1 settlement on a Grass hex. Build adjacent if possible.",
      notes: [],
      ask: "How do I use the Farm tile?",
    },
  },
  {
    name: "Oasis",
    trName: "Vaha",
    image: "/components/tile-oasis.webp",
    tr: {
      goal: "Desert'e +1 yerleşim.",
      scoring: "Desert (çöl) hex'ine 1 yerleşim kur. Mümkünse komşu kur.",
      notes: [],
      ask: "Oasis karosu nasıl kullanılır?",
    },
    en: {
      goal: "+1 settlement on Desert.",
      scoring: "Build 1 settlement on a Desert hex. Build adjacent if possible.",
      notes: [],
      ask: "How do I use the Oasis tile?",
    },
  },
  {
    name: "Tower",
    trName: "Kule",
    image: "/components/tile-tower.webp",
    tr: {
      goal: "Harita kenarına +1 yerleşim.",
      scoring: "Haritanın dış kenarındaki herhangi bir kurulabilir hex'e 1 yerleşim kur. Mümkünse komşu kur.",
      notes: ["Arazi türü fark etmez (5 kurulabilir türden biri)."],
      ask: "Tower karosu nasıl kullanılır?",
    },
    en: {
      goal: "+1 settlement on the board's edge.",
      scoring: "Build 1 settlement on any buildable hex on the outer edge of the board. Build adjacent if possible.",
      notes: ["Any of the 5 buildable terrains."],
      ask: "How do I use the Tower tile?",
    },
  },
  {
    name: "Tavern",
    trName: "Taverna",
    image: "/components/tile-tavern.webp",
    tr: {
      goal: "3'lü sıranın ucuna +1 yerleşim.",
      scoring: "Düz bir çizgide yan yana en az 3 yerleşiminin bir ucuna 1 yerleşim kur.",
      notes: ["Çizgi yatay ya da çapraz olabilir; hedef hex kurulabilir arazi olmalı."],
      ask: "Tavern karosu nasıl kullanılır?",
    },
    en: {
      goal: "+1 settlement at the end of a line of 3.",
      scoring: "Build 1 settlement at either end of a straight line of at least 3 of your settlements.",
      notes: ["The line can be horizontal or diagonal; the hex must be buildable."],
      ask: "How do I use the Tavern tile?",
    },
  },
  {
    name: "Barn",
    trName: "Ahır",
    image: "/components/tile-barn.webp",
    tr: {
      goal: "Yerleşimini kartındaki araziye taşı.",
      scoring: "Bir yerleşimini, bu tur oynadığın arazi kartıyla aynı türdeki bir hex'e taşı. Mümkünse komşu taşı.",
      notes: [],
      ask: "Barn karosu nasıl kullanılır?",
    },
    en: {
      goal: "Move a settlement to your card's terrain.",
      scoring: "Move one of your settlements to a hex of the terrain you played this turn. Adjacent if possible.",
      notes: [],
      ask: "How do I use the Barn tile?",
    },
  },
  {
    name: "Harbor",
    trName: "Liman",
    image: "/components/tile-harbor.webp",
    tr: {
      goal: "Yerleşimini suya taşı.",
      scoring: "Bir yerleşimini bir su hex'ine taşı. Mümkünse komşu taşı. Suya yerleşmenin tek yolu.",
      notes: [],
      ask: "Harbor karosu nasıl kullanılır?",
    },
    en: {
      goal: "Move a settlement onto water.",
      scoring: "Move one of your settlements to a water hex. Adjacent if possible. The only way onto water.",
      notes: [],
      ask: "How do I use the Harbor tile?",
    },
  },
  {
    name: "Paddock",
    trName: "Padok",
    image: "/components/tile-paddock.webp",
    tr: {
      goal: "Yerleşimini 2 hex zıplat.",
      scoring: "Bir yerleşimini düz bir çizgide tam 2 hex zıplat. Her şeyin üstünden atlayabilir.",
      notes: ["Hedef boş ve kurulabilir arazi olmalı; komşuluk kuralı uygulanmaz."],
      ask: "Paddock karosu nasıl kullanılır?",
    },
    en: {
      goal: "Jump a settlement 2 hexes.",
      scoring: "Move one of your settlements exactly 2 hexes in a straight line, jumping over anything.",
      notes: ["The target must be empty, buildable terrain; the adjacency rule doesn't apply."],
      ask: "How do I use the Paddock tile?",
    },
  },
];

export const ALL_COMPONENTS = [...KINGDOM_BUILDER_CARDS, ...LOCATION_TILES];

const MENTION = new RegExp(
  `\\b(${ALL_COMPONENTS.map((c) => c.name.replace(/s$/, "")).join("|")})s?\\b`,
  "gi",
);

/** Cards and tiles named in a piece of text, in order of first mention. */
export function mentionedComponents(text: string): GuideItem[] {
  const found = new Set<GuideItem>();
  for (const match of text.matchAll(MENTION)) {
    const word = match[1].toLowerCase();
    const item = ALL_COMPONENTS.find((c) => c.name.toLowerCase().replace(/s$/, "") === word);
    if (item) found.add(item);
  }
  return [...found];
}
