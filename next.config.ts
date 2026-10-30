import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Hearth is fully dynamic (every screen sits behind a session cookie),
  // so the classic rendering model is simpler and predictable here.
  cacheComponents: false,
  serverExternalPackages: ["@electric-sql/pglite"],
  experimental: { serverActions: { bodySizeLimit: "6mb" } },
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
