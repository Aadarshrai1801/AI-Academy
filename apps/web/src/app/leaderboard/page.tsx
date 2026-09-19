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
 * Leaderboard (§2.3, design plan §4.3) — the "vs others" screen.
 *
 * Deliberately shaped unlike /progress: a table with ordinal ranks and a
 * podium, not mastery cards. Competitive energy lives here; personal growth
 * lives there, so the two never blur into the same pattern.
 */
export default async function LeaderboardPage() {
  const entries = await getBoard();

  return (
    <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-6 sm:px-6 lg:px-8">
      {/* Header */}
      <div className="flex flex-col gap-4 border-b border-line pb-5 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-fg sm:text-2xl">Leaderboard</h1>
          <p className="mt-1 max-w-2xl text-xs text-fg-muted">
            Today&apos;s standings, updated live. Faster correct answers earn bonus points — the
            board resets at 00:00 UTC.
          </p>
        </div>

        <a href="#daily-gauntlet" className={buttonStyles("secondary", "sm")}>
          Hardest questions
        </a>
      </div>

      {entries.length === 0 ? (
        <div className="mt-8 space-y-8">
          <EmptyState
            icon={<Trophy className="h-6 w-6 text-fg" />}
            title="No one has scored today yet"
            description="The board updates live. Answer a question and you'll be today's first name on it."
            action={
              <Link href="/practice" className={buttonStyles("primary", "sm")}>
                Answer a question
              </Link>
            }
          />
          <div id="daily-gauntlet">
            <HardestQuestions />
          </div>
        </div>
      ) : (
        <div className="mt-6">
          <RankBoard initialEntries={entries} asideSlot={<HardestQuestions />} />
        </div>
      )}
    </main>
  );
}
