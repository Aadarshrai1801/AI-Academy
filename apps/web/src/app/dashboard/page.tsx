import { auth } from "@clerk/nextjs/server";
import Link from "next/link";
import { API_URL, type SummaryDTO } from "@/lib/api";
import { AnalyticsPanels } from "@/components/analytics-panels";
import { PortalButton } from "@/components/billing";

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

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ upgraded?: string }>;
}) {
  const { userId, getToken } = await auth();
  const { upgraded } = await searchParams;
  const summary = await getSummary(await getToken());

  const cards = [
    {
      label: "Active Streak",
      value: summary ? `${summary.streak.current}d` : "0d",
      sub: summary ? `Best streak: ${summary.streak.longest}d` : "Start today to begin streak",
      accent: true,
    },
    {
      label: "Total Points",
      value: summary ? `${summary.total.points.toLocaleString()} pts` : "0 pts",
      sub: "Cumulative across all epochs",
      accent: false,
    },
    {
      label: "Today's Score",
      value: summary ? `${summary.today.score} pts` : "0 pts",
      sub: summary ? `${summary.today.attempts} attempts recorded` : "No attempts logged today",
      accent: false,
    },
    {
      label: "Accuracy Rate",
      value: summary?.today.accuracy !== null && summary?.today.accuracy !== undefined
        ? `${Math.round(summary.today.accuracy * 100)}%`
        : "—",
      sub: "First-attempt convergence rate",
      accent: false,
    },
    {
      label: "Daily Ranking",
      value: summary?.rank.rank ? `#${summary.rank.rank.toString().padStart(2, "0")}` : "Unranked",
      sub: summary?.rank.rank ? `${summary.rank.score} pts today` : "Solve 1 problem to claim rank",
      accent: false,
    },
    {
      label: "Account Tier",
      value: summary?.role ? summary.role.toUpperCase() : "COMMUNITY",
      sub: summary?.role === "pro" ? "Unlimited compute access" : "Community tier (10/day)",
      accent: summary?.role === "pro",
    },
  ];

  return (
    <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-8 sm:px-6">
      {/* Crown */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between border-b border-[var(--seam)] pb-6">
        <div>
          <div className="flex items-center gap-2 font-mono text-xs text-[var(--ink-lead)]">
            <span>ENGINEER TELEMETRY //</span>
            <span className="text-[var(--tungsten)]">OVERVIEW</span>
          </div>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-[var(--ink-chalk)] sm:text-3xl">
            Dashboard
          </h1>
          <p className="mt-1 text-xs text-[var(--ink-lead)]">
            Performance telemetry, cognitive continuity, and ranking statistics.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Link
            href="/practice"
            className="flex items-center gap-2 rounded-md border border-[var(--tungsten)] bg-[var(--tungsten)] px-4 py-2 font-mono text-xs font-semibold text-black transition-opacity hover:opacity-90 shadow-[0_0_12px_rgba(229,133,55,0.2)]"
          >
            <span>Resume practice</span>
            <span>→</span>
          </Link>
        </div>
      </div>

      {upgraded && (
        <div className="mt-6 rounded-lg border border-[var(--converged)]/40 bg-[var(--converged)]/10 p-4 text-xs text-[var(--ink-chalk)]">
          <span className="font-mono font-bold text-[var(--converged)]">MEMBERSHIP UPGRADED // </span>
          <span>Pro tier active. Unlimited questions, full Hard bank, and on-demand AI video synthesis are now unlocked.</span>
        </div>
      )}

      {/* Telemetry Metric Cards */}
      <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {cards.map((c) => (
          <div
            key={c.label}
            className={`rounded-lg border p-4 transition-colors ${
              c.accent
                ? "border-[var(--tungsten)]/50 bg-[var(--tungsten)]/5 shadow-[0_0_15px_rgba(229,133,55,0.06)]"
                : "border-[var(--seam)] bg-[var(--chassis)] hover:border-[var(--seam-highlight)]"
            }`}
          >
            <div className="font-mono text-[11px] text-[var(--ink-lead)]">{c.label}</div>
            <div
              className={`mt-1.5 font-mono text-2xl font-bold tabular-nums ${
                c.accent ? "text-[var(--tungsten)]" : "text-[var(--ink-chalk)]"
              }`}
            >
              {c.value}
            </div>
            <div className="mt-1 text-[11px] text-[var(--ink-lead)]">{c.sub}</div>
          </div>
        ))}
      </div>

      {/* Onboarding Quick Action Banner if user has 0 attempts */}
      {(!summary || (summary.total.points === 0 && summary.today.attempts === 0)) && (
        <div className="mt-8 rounded-lg border border-[var(--seam)] bg-[var(--chassis)] p-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h2 className="text-sm font-semibold text-[var(--ink-chalk)]">
                Welcome to your Command Center
              </h2>
              <p className="mt-1 text-xs text-[var(--ink-lead)] max-w-xl">
                Start your first daily practice session to unlock cognitive streak continuity, personalized skill analytics, and global ranking.
              </p>
            </div>
            <Link
              href="/practice"
              className="inline-flex items-center gap-2 rounded-md border border-[var(--tungsten)] bg-[var(--tungsten)] px-4 py-2 font-mono text-xs font-semibold text-black hover:opacity-90 flex-shrink-0"
            >
              <span>Start Session</span>
              <span>→</span>
            </Link>
          </div>
        </div>
      )}

      {summary && (summary.total.points > 0 || summary.today.attempts > 0) && (
        <div className="mt-8 border-t border-[var(--seam)] pt-6">
          <AnalyticsPanels />
        </div>
      )}

      {summary?.role === "pro" && (
        <div className="mt-6 border-t border-[var(--seam)] pt-4">
          <PortalButton />
        </div>
      )}
    </main>
  );
}
