import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverActions: {
    bodySizeLimit: "4mb",
  },
  turbopack: {
    root: __dirname,
  },
};

export default nextConfig;
