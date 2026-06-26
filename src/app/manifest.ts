import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/m",
    name: "Infinya • Log",
    short_name: "Infinya Log",
    description: "Webapp operacional da Infinya para recebimento, separação e conferência logística.",
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
        src: "/branding/infinya-final.png",
        sizes: "1024x1024",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
