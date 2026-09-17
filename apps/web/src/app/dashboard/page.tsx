import Link from "next/link";
import { auth } from "@clerk/nextjs/server";
import { API_URL, type SummaryDTO } from "@/lib/api";
import { AnalyticsPanels } from "@/components/analytics-panels";
import { DashboardKpis } from "@/components/dashboard/kpi-grid";
import { ResumePracticeCta } from "@/components/dashboard/resume-cta";
import { EmptyState } from "@/components/ui";
import { Rocket } from "lucide-react";

async function getSummary(token: string | null): Promise<SummaryDTO | null> {
  if (!token) return null;
  try {
    const res = await fetch(`${API_URL}/attempts/me/summary`, {
      cache: "no-store",
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) return null;
    return (await res.json()) as SummaryDTO;
  } catch {
    return null;
  }
}

/**
 * Hours until the epoch boundary (00:00 UTC), when the streak opportunity for
 * today closes. Computed on the server so the client never has to guess.
 */
function hoursUntilUtcReset(): number {
  const now = new Date();
  const resetAt = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1);
  return (resetAt - now.getTime()) / 3_600_000;
}

/**
 * Dashboard (§2.7).
 *
 * Stays a server component so the numbers are in the first paint; the KPI grid
 * then hydrates into live telemetry and counts the values up. The header is
 * sticky so "Resume practice" stays reachable while scrolling — the brief's
 * "sticky/prominent" CTA without duplicating the button at the bottom of the
 * page.
 */
export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ upgraded?: string }>;
}) {
  const { getToken } = await auth();
  const { upgraded } = await searchParams;
  const summary = await getSummary(await getToken());

  const isBrandNew =
    !summary || (summary.total.points === 0 && summary.today.attempts === 0);

  return (
    <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-6 sm:px-6 lg:px-8">
      {/* Sticky crown: title + always-reachable primary action */}
      <div className="sticky top-14 z-20 -mx-4 flex flex-wrap items-center justify-between gap-3 border-b border-line bg-surface-0/80 backdrop-blur-md px-4 py-3 sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-fg sm:text-2xl">Dashboard</h1>
          <p className="mt-0.5 text-xs text-fg-muted">
            See your streak flame, daily points, and learning progress!
          </p>
        </div>
        <ResumePracticeCta />
      </div>

      {upgraded === "true" && (
        <div className="mt-6 rounded-card border border-success/40 bg-state-positive-soft p-3.5 text-xs text-fg shadow-card">
          Subscription updated — Champion limits are active. Have fun learning!
        </div>
      )}

      <div className="mt-6">
        <DashboardKpis
          initialSummary={summary}
          hoursLeftInEpoch={hoursUntilUtcReset()}
        />
      </div>

      {isBrandNew && (
        <div className="mt-6">
          <EmptyState
            icon={<Rocket className="h-6 w-6 text-fg" />}
            title="Your learning adventure is ready!"
            description="Answer your first puzzle to start your streak, earn points, and climb the daily leaderboard!"
            action={
              <Link
                href="/practice"
                className="rounded-btn border border-transparent bg-brand text-on-brand px-5 py-2 font-mono text-xs font-semibold shadow-sm transition-all hover:bg-brand-strong"
              >
                Start Practicing →
              </Link>
            }
          />
        </div>
      )}

      <div className="mt-6">
        <AnalyticsPanels />
      </div>
    </main>
  );
}
