import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  cacheComponents: true,
  partialPrefetching: true,
  // Pin the root to this folder; otherwise a stray lockfile higher up the disk can be picked instead.
  turbopack: { root: __dirname },
};

export default nextConfig;
