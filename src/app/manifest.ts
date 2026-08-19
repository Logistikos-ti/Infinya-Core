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
    // Arquivos distintos por finalidade — a mesma arte não serve às duas.
    // "any" é renderizado direto (taskbar, diálogo de instalação), então a
    // arte vem grande; "maskable" é recortado num círculo pelo SO, então a
    // arte vem menor para caber na safe zone. Todos são quadrados opacos
    // preenchidos com o fundo do brand: sem transparência, que é o que
    // fazia o Windows pintar branco por baixo. Gerados por
    // scripts/rebuild-pwa-icons.mjs a partir de infinoos-icon-wms.svg.
    icons: [
      {
        src: "/branding/infinoos-mark-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/branding/infinoos-mark-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/branding/infinoos-mark-maskable-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "maskable",
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
