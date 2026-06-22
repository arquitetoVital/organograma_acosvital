import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  allowedDevOrigins: ['172.20.8.60', '192.168.0.6'],
  turbopack: {
    root: process.cwd(),
  },
};

export default nextConfig;
