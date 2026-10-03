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
    id: "/",
    scope: "/",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
      { src: "/icon.svg", sizes: "any", type: "image/svg+xml" },
    ],
  };
}
