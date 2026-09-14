/**
 * Browser-safe environment validation.
 *
 * `NEXT_PUBLIC_*` values are inlined at build time; a typo or a missing
 * `NEXT_PUBLIC_API_URL` used to fail silently at runtime (every request
 * hitting localhost). Validation runs at server start (`instrumentation.ts`)
 * and the API client surfaces a clear error if a value is still broken.
 *
 * Builds in CI intentionally run without production keys, so hard failures are
 * production-runtime only (NEXT_PHASE is set during `next build`).
 */

export interface EnvIssue {
  key: string;
  message: string;
}

const PLACEHOLDER = /(change-me|replace-me|your-|<.*>)/i;

export function validateWebEnv(env: NodeJS.ProcessEnv = process.env): EnvIssue[] {
  const issues: EnvIssue[] = [];
  const isProd = env.NODE_ENV === "production";
  const isBuild = env.NEXT_PHASE === "phase-production-build";
  if (!isProd || isBuild) return issues;

  const apiUrl = env.NEXT_PUBLIC_API_URL?.trim();
  if (!apiUrl) {
    issues.push({ key: "NEXT_PUBLIC_API_URL", message: "API base URL is required in production." });
  } else {
    try {
      const parsed = new URL(apiUrl);
      if (parsed.protocol !== "https:" && parsed.hostname !== "localhost") {
        issues.push({ key: "NEXT_PUBLIC_API_URL", message: "Use https:// for the production API URL." });
      }
      if (parsed.pathname !== "/" && parsed.pathname !== "") {
        issues.push({ key: "NEXT_PUBLIC_API_URL", message: "Must be an origin only, e.g. https://api.example.com" });
      }
    } catch {
      issues.push({ key: "NEXT_PUBLIC_API_URL", message: `Not a valid URL: ${apiUrl}` });
    }
  }

  const clerkKey = env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY?.trim();
  if (!clerkKey || PLACEHOLDER.test(clerkKey)) {
    issues.push({
      key: "NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY",
      message: "Clerk publishable key is required in production.",
    });
  }
  if (!env.CLERK_SECRET_KEY?.trim()) {
    issues.push({ key: "CLERK_SECRET_KEY", message: "Clerk secret key is required for server-side auth()." });
  }
  return issues;
}

export function formatEnvIssues(issues: EnvIssue[]): string {
  return [
    `Web environment is misconfigured (${issues.length} issue(s)):`,
    ...issues.map((i) => `  - ${i.key}: ${i.message}`),
  ].join("\n");
}
