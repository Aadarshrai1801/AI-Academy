import * as Sentry from "@sentry/nextjs";
import { formatEnvIssues, validateWebEnv } from "./lib/env";

/**
 * Runs once when a new Next.js server instance starts.
 * - Refuses to serve in production with an incomplete environment (fail fast
 *   instead of shipping broken auth/API URLs to users).
 * - Forwards server-side request errors to Sentry when configured.
 */
export async function register() {
  const issues = validateWebEnv();
  if (issues.length === 0) return;
  const message = formatEnvIssues(issues);
  if (process.env.NODE_ENV === "production") {
    throw new Error(message);
  }
  console.warn(message);
}

export const onRequestError = Sentry.captureRequestError;
