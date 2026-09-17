import Link from "next/link";
import { API_URL, type BoardEntry } from "@/lib/api";
import { HardestQuestions } from "@/components/hardest-questions";
import { RankBoard } from "@/components/leaderboard/rank-board";
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
 * Modernized with a Grand Podium Pedestal, side-by-side Live Scoreboard and
 * Sticky Daily Gauntlet Rail, and a floating personal standing status bar.
 */
export default async function LeaderboardPage() {
  const entries = await getBoard();

  return (
    <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-6 sm:px-6 lg:px-8">
      {/* Header */}
      <div className="flex flex-col gap-4 border-b border-line pb-5 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="flex items-center gap-2 font-mono text-[10px] font-semibold uppercase tracking-wider text-fg-dim">
            <span>Global rankings</span>
            <span className="text-fg-muted">{"//"}</span>
            <span>Daily Rankings</span>
          </div>
          <h1 className="mt-1 text-xl font-bold tracking-tight text-fg sm:text-2xl">Leaderboard</h1>
          <p className="mt-0.5 max-w-2xl text-xs text-fg-muted">
            Points and ranks update every day as you solve puzzles. Faster correct answers earn bonus points!
          </p>
        </div>

        <a href="#daily-gauntlet" className={buttonStyles("primary", "sm")}>
          Daily Challenge
        </a>
      </div>

      {entries.length === 0 ? (
        <div className="mt-8 space-y-8">
          <EmptyState
            icon={<Trophy className="h-6 w-6 text-fg" />}
            title="No submissions in today's leaderboard yet"
            description="The board updates live. Solve today's challenge questions below to take 1st place!"
            action={
              <Link href="#daily-gauntlet" className={buttonStyles("primary", "sm")}>
                View Daily Challenge
              </Link>
            }
          />
          <HardestQuestions />
        </div>
      ) : (
        <div className="mt-6">
          <RankBoard initialEntries={entries} asideSlot={<HardestQuestions />} />
        </div>
      )}
    </main>
  );
}
