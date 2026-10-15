import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  // a stray package-lock.json in the home folder confuses root detection
  turbopack: { root: process.cwd() },
};

export default nextConfig;
