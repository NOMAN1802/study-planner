import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Every screen is per-user and auth-gated, so there is nothing to cache statically.
  cacheComponents: false,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
