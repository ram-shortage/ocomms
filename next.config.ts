import type { NextConfig } from "next";
import withSerwistInit from "@serwist/next";

const revision = process.env.VERCEL_GIT_COMMIT_SHA || crypto.randomUUID();

const withSerwist = withSerwistInit({
  swSrc: "src/app/sw.ts",
  swDest: "public/sw.js",
  additionalPrecacheEntries: [{ url: "/offline", revision }],
  disable: process.env.NODE_ENV === "development",
});

const nextConfig: NextConfig = {
  output: "standalone",
  // Acknowledge webpack plugin (Serwist) while using Turbopack for builds
  // Serwist is disabled in development, so this is safe
  turbopack: {},
};

export default withSerwist(nextConfig);
