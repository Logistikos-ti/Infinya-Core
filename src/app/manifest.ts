import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/m",
    name: "Infinoos WMS",
    short_name: "Infinoos",
    description:
      "Webapp operacional da Infinoos para recebimento, separação e conferência logística.",
    start_url: "/m/login",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#040816",
    theme_color: "#040816",
    categories: ["business", "productivity", "utilities"],
    lang: "pt-BR",
    icons: [
      {
        src: "/branding/infinoos-mark-192.png",
        sizes: "192x192",
        type: "image/png",
      },
      {
        src: "/branding/infinoos-mark-512.png",
        sizes: "512x512",
        type: "image/png",
      },
      {
        src: "/branding/infinoos-mark-maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
