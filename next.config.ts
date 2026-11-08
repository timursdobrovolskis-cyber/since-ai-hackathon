import type { NextConfig } from "next";

// The app is client-driven: replay state lives in the browser, so server component caching adds nothing here.
const nextConfig: NextConfig = {
  // The site used to live at /welcome. Old links land on the same page.
  async redirects() {
    return [{ source: "/welcome", destination: "/", permanent: false }];
  },
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
