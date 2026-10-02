import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Kingdom Builder Kural Hakemi",
    short_name: "Kural Hakemi",
    description: "Kingdom Builder kurallarını sesli veya yazılı sorun.",
    lang: "tr",
    start_url: "/",
    display: "standalone",
    background_color: "#f5ecd9",
    theme_color: "#2f5d3a",
    icons: [{ src: "/icon.svg", sizes: "any", type: "image/svg+xml" }],
  };
}
