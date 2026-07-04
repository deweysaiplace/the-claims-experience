import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async redirects() {
    return [
      { source: "/", destination: "/reconciler", permanent: false },
    ];
  },
};

export default nextConfig;
