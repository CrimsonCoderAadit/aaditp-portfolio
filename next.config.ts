import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  devIndicators: false,
  headers() {
    // Game Mode songs are large and change rarely: cache them for a week.
    return [{ source: "/audio/game-mode/:file(neffex-.*)", headers: [{ key: "Cache-Control", value: "public, max-age=604800" }] }];
  },
};

export default nextConfig;
