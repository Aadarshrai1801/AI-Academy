import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs/config";

const nextConfig: NextConfig = {
  /* Phase 0: transpile shared workspace package */
  transpilePackages: ["@ai-academy/shared"],
  // Docker (`apps/web/Dockerfile`) needs `standalone` for server.js.
  // Vercel sets VERCEL=1 and does its own tracing — `standalone` breaks
  // onBuildComplete with ENOENT next-server.js.nft.json, so skip it there.
  ...(process.env.VERCEL ? {} : { output: "standalone" }),
  poweredByHeader: false,
};

export default withSentryConfig(nextConfig, {
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  silent: !process.env.CI,
  widenClientFileUpload: true,
});
