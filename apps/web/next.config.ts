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
  // Baseline browser hardening. Deliberately no Content-Security-Policy yet:
  // Clerk/Ably/RealtimeKit/YouTube embeds load third-party scripts and a
  // strict CSP needs per-provider allow-listing (locked to actual prod URLs
  // during a launch audit — see docs/COMPLIANCE.md §9).
  async headers() {
    const security = [
      { key: "X-Content-Type-Options", value: "nosniff" },
      { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
      { key: "X-Frame-Options", value: "SAMEORIGIN" },
      {
        key: "Permissions-Policy",
        // Calls need camera/mic; everything else stays locked down.
        value: "camera=(self), microphone=(self), geolocation=(), payment=()",
      },
      {
        key: "Strict-Transport-Security",
        // Honored on HTTPS responses only; localhost dev over HTTP is unaffected.
        value: "max-age=63072000; includeSubDomains",
      },
    ];
    return [{ source: "/:path*", headers: security }];
  },
};

export default withSentryConfig(nextConfig, {
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  silent: !process.env.CI,
  widenClientFileUpload: true,
});
