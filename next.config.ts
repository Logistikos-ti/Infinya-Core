import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      bodySizeLimit: "4mb",
    },
    // lucide-react/date-fns são usados em muitos arquivos (156 e 22
    // respectivamente) -- pula a resolução do arquivo barrel do pacote pra
    // essas duas libs, achado na auditoria de performance de 2026-09-04.
    optimizePackageImports: ["lucide-react", "date-fns"],
  },
  images: {
    // Sem isso, next/image rejeita fotos/etiquetas vindas do Storage do
    // Supabase (produto, romaneio, etc.), e o código cai pra <img> cru sem
    // otimização -- achado na mesma auditoria.
    remotePatterns: [
      {
        protocol: "https",
        hostname: "*.supabase.co",
        pathname: "/storage/v1/object/**",
      },
    ],
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  turbopack: {
    root: __dirname,
  },
};

export default nextConfig;
