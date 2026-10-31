import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Hearth is fully dynamic (every screen sits behind a session cookie),
  // so the classic rendering model is simpler and predictable here.
  cacheComponents: false,
  serverExternalPackages: ["@electric-sql/pglite"],
  // A receipt photo (shrunk on the phone, base64) rides inside a server action call.
  experimental: { serverActions: { bodySizeLimit: "4mb" } },
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
