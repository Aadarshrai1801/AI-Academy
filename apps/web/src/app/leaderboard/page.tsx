import Link from "next/link";
import { auth } from "@clerk/nextjs/server";
import { API_URL, type BoardEntry, type SummaryDTO } from "@/lib/api";
import { RankHistory } from "@/components/rank-history";

async function getBoard(): Promise<BoardEntry[]> {
  try {
    const res = await fetch(`${API_URL}/leaderboard/daily?limit=50`, {
      cache: "no-store",
    });
    if (!res.ok) return [];
    const data = (await res.json()) as { entries?: BoardEntry[] };
    return data.entries ?? [];
  } catch {
    return [];
  }
}

async function getUserStanding(token: string | null): Promise<{ rank: number | null; score: number } | null> {
  if (!token) return null;
  try {
    const res = await fetch(`${API_URL}/leaderboard/me`, {
      cache: "no-store",
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) return null;
    return (await res.json()) as { rank: number | null; score: number };
  } catch {
    return null;
  }
}

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

export default async function LeaderboardPage() {
  const { getToken, userId } = await auth();
  const token = await getToken();

  const [entries, userStanding, userSummary] = await Promise.all([
    getBoard(),
    getUserStanding(token),
    getSummary(token),
  ]);

  const topThree = entries.slice(0, 3);
  const remaining = entries.slice(3);

  const hasUserRank = userStanding && userStanding.rank !== null && userStanding.rank !== undefined;

  return (
    <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-8 sm:px-6">
      {/* Header & Epoch Telemetry */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between border-b border-[var(--seam)] pb-6">
        <div>
          <div className="flex items-center gap-2 font-mono text-xs text-[var(--ink-lead)]">
            <span>GLOBAL RANKINGS //</span>
            <span className="text-[var(--tungsten)]">DAILY EPOCH</span>
          </div>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-[var(--ink-chalk)] sm:text-3xl">
            Leaderboard
          </h1>
          <p className="mt-1 text-xs text-[var(--ink-lead)]">
            Reset epoch runs daily at 00:00 UTC. Rank calculation factors in correctness, speed, and difficulty tier.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Link
            href="/practice"
            className="rounded-md border border-[var(--tungsten)] bg-[var(--tungsten)] px-4 py-1.5 text-xs font-semibold text-black transition-opacity hover:opacity-90"
          >
            Practice to rank up
          </Link>
        </div>
      </div>

      {/* When no submissions recorded yet in today's epoch */}
      {entries.length === 0 && (
        <div className="mt-10 rounded-lg border border-[var(--seam)] bg-[var(--chassis)] p-12 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full border border-[var(--tungsten)]/30 bg-[var(--tungsten)]/10 text-xl text-[var(--tungsten)]">
            🏆
          </div>
          <h2 className="mt-4 text-base font-semibold text-[var(--ink-chalk)]">
            No Submissions in Today&apos;s Epoch Yet
          </h2>
          <p className="mx-auto mt-2 max-w-md text-xs text-[var(--ink-lead)] leading-relaxed">
            The leaderboard resets every day at 00:00 UTC. Be the first engineer to solve a problem today and claim Rank #1!
          </p>
          <div className="mt-6">
            <Link
              href="/practice"
              className="inline-flex items-center gap-2 rounded-md border border-[var(--tungsten)] bg-[var(--tungsten)] px-5 py-2 font-mono text-xs font-semibold text-black hover:opacity-90"
            >
              <span>Start Practice Session</span>
              <span>→</span>
            </Link>
          </div>
        </div>
      )}

      {/* Top 3 Titanium Monoliths (Rendered when entries exist) */}
      {topThree.length > 0 && (
        <div className="mt-8 grid grid-cols-1 gap-4 md:grid-cols-3">
          {topThree.map((item, idx) => {
            const isGold = item.rank === 1;
            return (
              <div
                key={item.userId}
                className={`relative flex flex-col justify-between rounded-lg border p-5 ${
                  isGold
                    ? "border-[var(--tungsten)] bg-[var(--tungsten)]/5 shadow-[0_0_24px_rgba(229,133,55,0.08)]"
                    : "border-[var(--seam)] bg-[var(--chassis)]"
                }`}
              >
                <div>
                  <div className="flex items-center justify-between">
                    <span
                      className={`font-mono text-xs font-bold ${
                        isGold ? "text-[var(--tungsten)]" : "text-[var(--ink-lead)]"
                      }`}
                    >
                      RANK #{item.rank.toString().padStart(2, "0")}
                    </span>
                    <span className="font-mono text-[11px] text-[var(--ink-lead)]">
                      {idx === 0 ? "TOP 1%" : idx === 1 ? "TOP 3%" : "TOP 5%"}
                    </span>
                  </div>

                  <div className="mt-3 flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-md border border-[var(--seam-highlight)] bg-[var(--panel)] font-mono text-sm font-bold text-[var(--ink-chalk)]">
                      {item.username.slice(0, 2).toUpperCase()}
                    </div>
                    <div>
                      <div className="text-sm font-semibold text-[var(--ink-chalk)]">
                        {item.username}
                      </div>
                      <div className="font-mono text-xs text-[var(--ink-lead)]">
                        Active Contender
                      </div>
                    </div>
                  </div>
                </div>

                <div className="mt-6 flex items-baseline justify-between border-t border-[var(--seam)] pt-3 font-mono">
                  <span className="text-xs text-[var(--ink-lead)]">Daily Score</span>
                  <span className="text-base font-semibold tabular-nums text-[var(--ink-chalk)]">
                    {item.score.toLocaleString()} pts
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* High-Density Leaderboard Table */}
      {remaining.length > 0 && (
        <div className="mt-8 overflow-hidden rounded-lg border border-[var(--seam)] bg-[var(--chassis)]">
          <div className="border-b border-[var(--seam)] bg-[var(--panel)] px-4 py-2.5 font-mono text-[11px] text-[var(--ink-lead)]">
            <div className="grid grid-cols-12 gap-2">
              <span className="col-span-2 sm:col-span-1">RANK</span>
              <span className="col-span-6 sm:col-span-8">ENGINEER</span>
              <span className="col-span-4 sm:col-span-3 text-right">POINTS</span>
            </div>
          </div>

          <div className="divide-y divide-[var(--seam)] font-mono text-xs">
            {remaining.map((r) => (
              <div
                key={r.userId}
                className="grid grid-cols-12 items-center gap-2 px-4 py-3 text-[var(--ink-chalk)] transition-colors hover:bg-[var(--panel)]"
              >
                <span className="col-span-2 sm:col-span-1 text-[var(--ink-lead)] tabular-nums">
                  #{r.rank.toString().padStart(2, "0")}
                </span>
                <span className="col-span-6 sm:col-span-8 font-sans font-medium text-[var(--ink-chalk)] truncate">
                  {r.username}
                </span>
                <span className="col-span-4 sm:col-span-3 text-right font-semibold tabular-nums text-[var(--ink-chalk)]">
                  {r.score.toLocaleString()} pts
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* User Standing Bar (Real Telemetry, No Hardcoded Mock) */}
      <div className="sticky bottom-4 z-30 mt-8 rounded-lg border border-[var(--seam-highlight)] bg-[var(--chassis)]/95 p-4 shadow-xl backdrop-blur-md">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between text-xs">
          <div className="flex items-center gap-3">
            <span className="rounded bg-[var(--tungsten)]/20 px-2 py-0.5 font-mono text-[11px] font-semibold text-[var(--tungsten)]">
              YOUR STANDING
            </span>
            {hasUserRank ? (
              <span className="font-mono text-[var(--ink-chalk)]">
                Rank <strong className="text-[var(--tungsten)]">#{userStanding.rank}</strong> · <strong className="tabular-nums">{userStanding.score} pts</strong> today {userSummary?.streak.current ? `· ${userSummary.streak.current}d streak` : ""}
              </span>
            ) : userId ? (
              <span className="text-[var(--ink-lead)]">
                You haven&apos;t completed a question in today&apos;s epoch yet. Solve a problem to rank!
              </span>
            ) : (
              <span className="text-[var(--ink-lead)]">
                Sign in to record your scores and appear on the daily leaderboard.
              </span>
            )}
          </div>

          <div className="flex items-center gap-3">
            <Link
              href="/practice"
              className="rounded border border-[var(--seam)] bg-[var(--panel)] px-3 py-1.5 font-medium text-[var(--ink-chalk)] transition-colors hover:border-[var(--tungsten)]"
            >
              Practice now →
            </Link>
          </div>
        </div>
      </div>

      <div className="mt-8">
        <RankHistory />
      </div>
    </main>
  );
}
