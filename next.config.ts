import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "pub-aee5a0705b5048b3bc38888dd602aeac.r2.dev",
      },
    ],
  },
};

export default nextConfig;
