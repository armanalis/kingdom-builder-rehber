// Static quick-reference shown in the UI (no AI needed).
// Names stay in English (as printed on the components), explanations in Turkish.

export type GuideItem = {
  name: string;
  goal: string;
  scoring: string;
  notes: string[];
  ask: string;
  accent: string;
};

export const KINGDOM_BUILDER_CARDS: GuideItem[] = [
  {
    name: "Farmers",
    goal: "Her çeyreğe yerleşim kur.",
    scoring:
      "En az yerleşimin olan çeyrekteki her yerleşimin için 3 altın.",
    notes: [
      "Her oyuncu kendi için bakar: 4 çeyrekteki yerleşim sayılarından en küçüğü × 3.",
      "Çeyrekteki toplam sayı önemli, bağlı olmaları gerekmez.",
      "Bir çeyrekte hiç yerleşimin yoksa 0 altın.",
      "Örnek: 10, 6, 6, 4 → 4 × 3 = 12 altın.",
    ],
    ask: "Farmers kartı nasıl puanlanır?",
    accent: "#8db849",
  },
  {
    name: "Lords",
    goal: "Her çeyrekte en çok yerleşime sahip ol.",
    scoring:
      "Her çeyrek ayrı: en çok yerleşimi olan 12 altın, ikinci en çok olan 6 altın.",
    notes: [
      "Sadece sayı önemli, bağlı olmaları gerekmez.",
      "Birincilikte beraberlik: hepsi 12 alır, sonraki sayı yine 6 alır (8, 8, 6, 2 → 12, 12, 6, 0).",
      "İkincilikte beraberlik: hepsi 6 alır.",
    ],
    ask: "Lords kartında beraberlik olursa ne olur?",
    accent: "#9b4f96",
  },
  {
    name: "Knights",
    goal: "Tek bir yatay sırada çok yerleşim kur.",
    scoring:
      "En çok yerleşimin olan yatay sıradaki her yerleşimin için 2 altın.",
    notes: [
      "Sadece en iyi TEK sıra sayılır.",
      "Sıra tüm haritayı yatay boydan boya geçer; yerleşimlerin yan yana olması gerekmez.",
    ],
    ask: "Knights kartında hangi sıra sayılır?",
    accent: "#c9a227",
  },
  {
    name: "Discoverers",
    goal: "Mümkün olduğunca çok yatay sırada yerleşim kur.",
    scoring:
      "En az bir yerleşimin olan her yatay sıra için 1 altın.",
    notes: ["Haritada 20 yatay sıra var, en fazla 20 altın."],
    ask: "Discoverers kartı nasıl sayılır?",
    accent: "#d9822b",
  },
  {
    name: "Merchants",
    goal: "Lokasyon ve kaleleri kendi yerleşimlerinle birbirine bağla.",
    scoring:
      "Yerleşim zincirinle başka bir lokasyon/kaleye bağlanan her lokasyon veya kale için 4 altın.",
    notes: [
      "3 lokasyonu bağlayan tek zincir = 12 altın.",
      "Hiçbir yere bağlanmayan lokasyon = 0.",
      "Karosu bitmiş lokasyonlar da sayılır.",
    ],
    ask: "Merchants kartında bağlantı nasıl sayılır?",
    accent: "#b5651d",
  },
  {
    name: "Citizens",
    goal: "Büyük tek bir yerleşim alanı oluştur.",
    scoring:
      "En büyük bağlı yerleşim grubundaki her 2 yerleşim için 1 altın.",
    notes: ["Sadece en büyük grup sayılır, aşağı yuvarlanır (9 → 4 altın)."],
    ask: "Citizens kartında hangi grup sayılır?",
    accent: "#3f8f7a",
  },
  {
    name: "Hermits",
    goal: "Çok sayıda ayrı yerleşim alanı oluştur.",
    scoring: "Birbirinden ayrı her yerleşim grubu için 1 altın.",
    notes: ["Tek başına duran bir yerleşim de bir grup sayılır."],
    ask: "Hermits kartında tek yerleşim grup sayılır mı?",
    accent: "#5b7a3a",
  },
  {
    name: "Fishermen",
    goal: "Su kenarına yerleşim kur.",
    scoring:
      "En az bir su hex'ine komşu olan her yerleşimin için 1 altın.",
    notes: [
      "Her yerleşim en fazla 1 altın verir.",
      "Harbor ile suyun ÜSTÜNE konan yerleşimler altın vermez.",
    ],
    ask: "Fishermen kartında suyun üstündeki yerleşim sayılır mı?",
    accent: "#3a86c8",
  },
  {
    name: "Miners",
    goal: "Dağ kenarına yerleşim kur.",
    scoring:
      "En az bir dağ hex'ine komşu olan her yerleşimin için 1 altın.",
    notes: ["Her yerleşim en fazla 1 altın verir."],
    ask: "Miners kartı nasıl puanlanır?",
    accent: "#6b6f78",
  },
  {
    name: "Workers",
    goal: "Lokasyon ve kalelerin yanına yerleşim kur.",
    scoring:
      "Bir lokasyona veya kaleye komşu olan her yerleşimin için 1 altın.",
    notes: ["İkisine birden komşu olsa da 1 altın; bağlantı gerekmez."],
    ask: "Workers kartı nasıl puanlanır?",
    accent: "#8a5a3c",
  },
];

export const LOCATION_TILES: GuideItem[] = [
  {
    name: "Oracle",
    goal: "Kartındaki araziye +1 yerleşim.",
    scoring:
      "Bu tur oynadığın arazi kartıyla aynı arazi türüne 1 yerleşim kur. Mümkünse komşu kur.",
    notes: [],
    ask: "Oracle karosu nasıl kullanılır?",
    accent: "#7a5cc7",
  },
  {
    name: "Farm",
    goal: "Grass'a +1 yerleşim.",
    scoring: "Grass (çimen) hex'ine 1 yerleşim kur. Mümkünse komşu kur.",
    notes: [],
    ask: "Farm karosu nasıl kullanılır?",
    accent: "#8db849",
  },
  {
    name: "Oasis",
    goal: "Desert'e +1 yerleşim.",
    scoring: "Desert (çöl) hex'ine 1 yerleşim kur. Mümkünse komşu kur.",
    notes: [],
    ask: "Oasis karosu nasıl kullanılır?",
    accent: "#e2b84a",
  },
  {
    name: "Tower",
    goal: "Harita kenarına +1 yerleşim.",
    scoring:
      "Haritanın dış kenarındaki herhangi bir kurulabilir hex'e 1 yerleşim kur. Mümkünse komşu kur.",
    notes: ["Arazi türü fark etmez (5 kurulabilir türden biri)."],
    ask: "Tower karosu nasıl kullanılır?",
    accent: "#9a6b4f",
  },
  {
    name: "Tavern",
    goal: "3'lü sıranın ucuna +1 yerleşim.",
    scoring:
      "Düz bir çizgide yan yana en az 3 yerleşiminin bir ucuna 1 yerleşim kur.",
    notes: ["Çizgi yatay ya da çapraz olabilir; hedef hex kurulabilir arazi olmalı."],
    ask: "Tavern karosu nasıl kullanılır?",
    accent: "#b5651d",
  },
  {
    name: "Barn",
    goal: "Yerleşimini kartındaki araziye taşı.",
    scoring:
      "Bir yerleşimini, bu tur oynadığın arazi kartıyla aynı türdeki bir hex'e taşı. Mümkünse komşu taşı.",
    notes: [],
    ask: "Barn karosu nasıl kullanılır?",
    accent: "#a23b2a",
  },
  {
    name: "Harbor",
    goal: "Yerleşimini suya taşı.",
    scoring:
      "Bir yerleşimini bir su hex'ine taşı. Mümkünse komşu taşı. Suya yerleşmenin tek yolu.",
    notes: [],
    ask: "Harbor karosu nasıl kullanılır?",
    accent: "#3a86c8",
  },
  {
    name: "Paddock",
    goal: "Yerleşimini 2 hex zıplat.",
    scoring:
      "Bir yerleşimini düz bir çizgide tam 2 hex zıplat. Her şeyin üstünden atlayabilir.",
    notes: ["Hedef boş ve kurulabilir arazi olmalı; komşuluk kuralı uygulanmaz."],
    ask: "Paddock karosu nasıl kullanılır?",
    accent: "#6f8f3a",
  },
];

export const QUICK_QUESTIONS = [
  "Komşu kurma kuralı tam olarak nasıl işliyor?",
  "Lokasyon karosunu aldığım tur kullanabilir miyim?",
  "Oyun ne zaman bitiyor?",
  "Kaleler kaç altın veriyor?",
];
