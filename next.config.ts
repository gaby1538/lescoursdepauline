import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  experimental: {
    serverActions: {
      // Les documents pédagogiques montent jusqu'à 10 Mo, comme le
      // contrôle posé sur la table. La limite par défaut est de 1 Mo.
      bodySizeLimit: "12mb",
    },
  },
};

export default nextConfig;
