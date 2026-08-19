import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "Infinoos WMS",
    short_name: "WMS",
    description:
      "Webapp operacional da Infinoos para recebimento, separação e conferência logística.",
    // A raiz decide entre /login (desktop) e /m/login (mobile) pelo user-agent
    // do primeiro request. Um manifest só pode ter um start_url, então usamos
    // esse ponto de bifurcação para instalar bem nos dois casos.
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#040816",
    theme_color: "#040816",
    categories: ["business", "productivity", "utilities"],
    lang: "pt-BR",
    // Cada ícone é declarado duas vezes: uma como "any" (para o launcher
    // padrão) e outra como "maskable" (para o recorte adaptativo do Android
    // e do PWA no desktop). Sem a variante maskable o SO desenha um fundo
    // branco atrás do PNG. Confirmado que o mesmo arquivo serve aos dois
    // usos: infinoos-mark-512.png e infinoos-mark-maskable-512.png eram
    // byte a byte idênticos, ou seja, a arte já preenche a área com o fundo
    // do brand — safe zone respeitada.
    icons: [
      {
        src: "/branding/infinoos-mark-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/branding/infinoos-mark-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "maskable",
      },
      {
        src: "/branding/infinoos-mark-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/branding/infinoos-mark-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
