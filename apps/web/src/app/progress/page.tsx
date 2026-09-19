import { auth } from "@clerk/nextjs/server";
import { API_URL, type MasteryResponse } from "@/lib/api";
import { MasteryPanel } from "@/components/mastery/mastery-panel";

async function getMastery(token: string | null): Promise<MasteryResponse | null> {
  if (!token) return null;
  try {
    const res = await fetch(`${API_URL}/users/me/mastery`, {
      cache: "no-store",
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) return null;
    return (await res.json()) as MasteryResponse;
  } catch {
    return null;
  }
}

/**
 * Learning-progress dashboard (Phase 9).
 *
 * Server-rendered first paint of the mastery table + the client-side placement
 * quiz and live refresh (MasteryPanel). Separate from the admin analytics
 * surface: this is the learner's own per-topic mastery and adaptive difficulty
 * guidance.
 */
export default async function ProgressPage() {
  const { getToken } = await auth();
  const mastery = await getMastery(await getToken());

  return (
    <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-6 sm:px-6 lg:px-8">
      <div className="flex flex-wrap items-end justify-between gap-3 border-b border-line pb-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-fg sm:text-2xl">Progress</h1>
          <p className="mt-1 text-xs text-fg-muted">
            Where you are, and which way you&apos;re moving — trajectory over time, not a score.
          </p>
        </div>
      </div>

      <div className="mt-6">
        <MasteryPanel initial={mastery} />
      </div>
    </main>
  );
}
