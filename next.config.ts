import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  experimental: {
    serverActions: {
      // Les documents ne transitent plus par le site : ils montent en
      // direct vers le stockage. Il ne reste ici que des formulaires.
      bodySizeLimit: "2mb",
    },
  },
};

export default nextConfig;
