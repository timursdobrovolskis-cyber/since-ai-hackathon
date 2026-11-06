import type { NextConfig } from "next";

// The app is client-driven: replay state lives in the browser, so server component caching adds nothing here.
const nextConfig: NextConfig = {
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
