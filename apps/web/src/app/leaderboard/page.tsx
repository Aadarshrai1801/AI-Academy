import Link from "next/link";
import { API_URL, type BoardEntry } from "@/lib/api";
import { HardestQuestions } from "@/components/hardest-questions";
import { RankBoard } from "@/components/leaderboard/rank-board";
import { RankHistory } from "@/components/rank-history";
import { EmptyState, buttonStyles } from "@/components/ui";
import { Trophy } from "lucide-react";

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

/**
 * Leaderboard (§2.3).
 *
 * Server-rendered for first paint, with the scoreboard handed to a client
 * component so rank changes animate (FLIP) rather than jumping. The Daily
 * Gauntlet sits directly under the header so the day's questions — and the
 * chance to enter the board — are the first thing visible.
 */
export default async function LeaderboardPage() {
  const entries = await getBoard();

  return (
    <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 sm:px-6 lg:px-8">
      {/* Header */}
      <div className="flex flex-col gap-4 border-b border-line pb-5 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="flex items-center gap-2 font-mono text-[10px] font-semibold uppercase tracking-wider text-fg-dim">
            <span>Global rankings</span>
            <span className="text-brand">{"//"}</span>
            <span>Daily epoch</span>
          </div>
          <h1 className="mt-1 text-xl font-bold tracking-tight text-fg sm:text-2xl">Leaderboard</h1>
          <p className="mt-0.5 max-w-2xl text-xs text-fg-muted">
            The epoch resets at 00:00 UTC. Rankings weigh correctness, speed, and difficulty tier.
          </p>
        </div>

        <a href="#daily-gauntlet" className={buttonStyles("primary", "sm")}>
          Solve the gauntlet
        </a>
      </div>

      {/* Daily Gauntlet: the fixed 10-question set for today */}
      <div className="mt-6">
        <HardestQuestions />
      </div>

      {entries.length === 0 ? (
        <div className="mt-8">
          <EmptyState
            icon={<Trophy className="h-6 w-6 text-brand" />}
            title="No submissions in today's epoch yet"
            description="The board resets at 00:00 UTC. Solve a gauntlet question to claim Rank #1."
            action={
              <Link href="#daily-gauntlet" className={buttonStyles("primary", "sm")}>
                View today&apos;s gauntlet
              </Link>
            }
          />
        </div>
      ) : (
        <RankBoard initialEntries={entries} />
      )}

      <div className="mt-8">
        <RankHistory />
      </div>
    </main>
  );
}
