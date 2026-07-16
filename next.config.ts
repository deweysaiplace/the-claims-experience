import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  eslint: {
    ignoreDuringBuilds: true,
  },
  async redirects() {
    return [
      { source: "/", destination: "/reconciler", permanent: false },
    ];
  },
};

export default nextConfig;
