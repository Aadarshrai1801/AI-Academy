"use client";

import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@clerk/nextjs";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Ban, Check, CircleAlert, Inbox, RefreshCw, ShieldAlert } from "lucide-react";
import { ApiError, apiFetch, type ReviewItem } from "@/lib/api";
import { AdminHeader, AdminShell } from "@/components/admin/admin-header";
import {
  Badge,
  Button,
  Card,
  DifficultyBadge,
  EmptyState,
  Skeleton,
  SkeletonText,
  useToast,
} from "@/components/ui";
import { SPRING } from "@/lib/motion";
import { cn } from "@/lib/cn";

type Filter = "pending_review" | "flagged";

const FILTERS: Array<{ value: Filter; label: string; hint: string }> = [
  { value: "pending_review", label: "Pending", hint: "Awaiting a decision" },
  { value: "flagged", label: "Flagged", hint: "Hidden from serving" },
];

/**
 * Admin · review queue (§ admin surface).
 *
 * Approving publishes to the practice pool and flagging hides from serving, so
 * both actions are destructive-ish: they remove the card immediately and
 * confirm with a toast that names the outcome, rather than silently vanishing.
 * The quality score, model and flag reason are surfaced as badges because they
 * are the signals a reviewer actually decides on.
 */
export default function ReviewPage() {
  const { getToken, isLoaded } = useAuth();
  const toast = useToast();
  const reduced = useReducedMotion();

  const [filter, setFilter] = useState<Filter>("pending_review");
  const [items, setItems] = useState<ReviewItem[] | null>(null);
  const [failed, setFailed] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(
    async (nextFilter: Filter) => {
      try {
        const result = await apiFetch<{ items: ReviewItem[] }>(
          `/admin/review?status=${nextFilter}&limit=25`,
          { token: await getToken() },
        );
        setItems(result.items);
        setFailed(null);
      } catch (e) {
        setFailed(
          e instanceof ApiError && e.status === 403
            ? "Admin role required — promote your user first (see README)."
            : e instanceof Error
              ? `Could not load queue: ${e.message}`
              : "Could not load queue.",
        );
        setItems([]);
      }
    },
    [getToken],
  );

  useEffect(() => {
    if (!isLoaded) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load(filter);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoaded]);

  async function decide(id: string, status: "approved" | "flagged") {
    setBusy(id);
    try {
      await apiFetch(`/admin/review/${id}`, {
        method: "PATCH",
        token: await getToken(),
        body: { status },
      });
      setItems((prev) => (prev ?? []).filter((item) => item.id !== id));
      toast({
        title: status === "approved" ? "Published to practice pool" : "Flagged and hidden",
        description: status === "approved" ? "Served to users immediately." : "Will not be served.",
        variant: status === "approved" ? "success" : "warning",
      });
    } catch (e) {
      toast({
        title: "Decision failed",
        description: e instanceof Error ? e.message : "Unknown error.",
        variant: "error",
      });
    } finally {
      setBusy(null);
    }
  }

  return (
    <AdminShell>
      <AdminHeader
        title="Review queue"
        description="Human-in-the-loop triage for low-confidence and flagged generations. Approving publishes to the practice pool; flagging hides the question from serving."
        actions={
          <>
            <div
              role="radiogroup"
              aria-label="Queue filter"
              className="flex items-center gap-0.5 rounded-btn border border-line bg-surface-2 p-0.5"
            >
              {FILTERS.map((option) => {
                const active = filter === option.value;
                return (
                  <button
                    key={option.value}
                    type="button"
                    role="radio"
                    aria-checked={active}
                    title={option.hint}
                    onClick={() => {
                      setFilter(option.value);
                      setItems(null);
                      void load(option.value);
                    }}
                    className={cn(
                      "relative rounded-[6px] px-3 py-1.5 text-xs font-medium transition-colors",
                      active ? "text-fg" : "text-fg-muted hover:text-fg",
                    )}
                  >
                    {active && (
                      <motion.span
                        layoutId="review-filter-active"
                        transition={reduced ? { duration: 0 } : SPRING.snappy}
                        className="absolute inset-0 rounded-[6px] bg-surface-4 shadow-card"
                        aria-hidden="true"
                      />
                    )}
                    <span className="relative z-10">{option.label}</span>
                  </button>
                );
              })}
            </div>
            <Button
              variant="secondary"
              size="sm"
              leftIcon={<RefreshCw className="h-3.5 w-3.5" />}
              onClick={() => {
                setItems(null);
                void load(filter);
              }}
            >
              Refresh
            </Button>
          </>
        }
      />

      {failed && (
        <div className="mt-6 flex items-center gap-2 rounded-card border border-line-strong bg-surface-2 px-4 py-3 text-xs text-fg">
          <CircleAlert className="h-3.5 w-3.5 shrink-0 text-fg-muted" aria-hidden="true" />
          {failed}
        </div>
      )}

      {/* Loading */}
      {items === null && !failed && (
        <div className="mt-6 flex flex-col gap-4">
          {[0, 1].map((card) => (
            <Card key={card} className="p-6">
              <div className="flex gap-2">
                {[0, 1, 2, 3].map((chip) => (
                  <Skeleton key={chip} className="h-5 w-16 rounded-full" />
                ))}
              </div>
              <SkeletonText lines={3} className="mt-4" />
            </Card>
          ))}
        </div>
      )}

      {/* Empty */}
      {items !== null && items.length === 0 && !failed && (
        <Card className="mt-6">
          <EmptyState
            icon={<Inbox className="h-6 w-6 text-fg-muted" />}
            title={filter === "pending_review" ? "Queue is clear" : "Nothing flagged"}
            description={
              filter === "pending_review"
                ? "Every generated question has been reviewed. New items appear here as generation runs."
                : "No questions are currently hidden from serving."
            }
          />
        </Card>
      )}

      {/* Items */}
      <div className="mt-6 flex flex-col gap-4">
        <AnimatePresence initial={false}>
          {(items ?? []).map((question) => {
            const lowScore =
              typeof question.quality_score === "number" && question.quality_score < 0.7;
            return (
              <motion.div
                key={question.id}
                layout
                initial={reduced ? { opacity: 0 } : { opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={reduced ? { opacity: 0 } : { opacity: 0, scale: 0.98 }}
                transition={SPRING.layout}
              >
                <Card className="p-5 sm:p-6">
                  {/* Metadata rail */}
                  <div className="flex flex-wrap items-center gap-2">
                    <DifficultyBadge difficulty={question.difficulty as "easy" | "medium" | "hard"} />
                    <Badge variant="neutral" size="sm" square>
                      {question.topic}
                    </Badge>
                    <Badge variant="neutral" size="sm" square>
                      {question.type}
                    </Badge>
                    {question.subtopic && (
                      <Badge variant="neutral" size="sm" square>
                        {question.subtopic}
                      </Badge>
                    )}
                    {question.generation_model && (
                      <Badge variant="neutral" size="sm" icon={<ShieldAlert className="h-3 w-3" aria-hidden="true" />}>
                        {question.generation_model}
                      </Badge>
                    )}
                    {typeof question.quality_score === "number" && (
                      <Badge variant={lowScore ? "outline" : "solid"} size="sm">
                        score {question.quality_score.toFixed(2)}
                      </Badge>
                    )}
                    <span className="ml-auto font-mono text-[10px] text-fg-dim">{question.source}</span>
                  </div>

                  <p className="mt-3.5 text-sm leading-relaxed font-medium text-fg">{question.prompt}</p>

                  {question.options && question.options.length > 0 && (
                    <ul className="mt-3 flex flex-col gap-1.5">
                      {question.options.map((option) => {
                        const isAnswer = option.trim() === question.correct_answer.trim();
                        return (
                          <li
                            key={option}
                            className={cn(
                              "flex items-start gap-2 rounded-lg border px-2.5 py-1.5 text-xs",
                              isAnswer
                                ? "border-success/40 bg-state-positive-soft font-medium text-fg"
                                : "border-line bg-surface-3 text-fg-muted",
                            )}
                          >
                            {isAnswer ? (
                              <Check className="mt-0.5 h-3 w-3 shrink-0 text-success" aria-hidden="true" />
                            ) : (
                              <span className="mt-0.5 h-3 w-3 shrink-0" aria-hidden="true" />
                            )}
                            {option}
                          </li>
                        );
                      })}
                    </ul>
                  )}

                  {!question.options?.length && (
                    <p className="mt-3 rounded-lg border border-success/40 bg-state-positive-soft px-3 py-2 text-xs text-fg">
                      <span className="font-mono font-semibold text-state-positive-ink">Answer: </span>
                      {question.correct_answer}
                    </p>
                  )}

                  <p className="mt-3 text-xs leading-relaxed text-fg-muted">{question.explanation}</p>

                  {question.flag_reason && (
                    <p className="mt-3 flex items-start gap-2 rounded-lg border border-line-strong bg-surface-2 px-3 py-2 text-[11px] text-fg">
                      <ShieldAlert className="mt-0.5 h-3.5 w-3.5 shrink-0 text-fg-muted" aria-hidden="true" />
                      <span>
                        <span className="font-mono font-semibold text-fg">Flagged: </span>
                        {question.flag_reason}
                      </span>
                    </p>
                  )}

                  <div className="mt-5 flex flex-wrap items-center gap-3 border-t border-line pt-4">
                    <Button
                      loading={busy === question.id}
                      disabled={busy !== null}
                      leftIcon={<Check className="h-3.5 w-3.5" />}
                      onClick={() => void decide(question.id, "approved")}
                    >
                      Approve &amp; publish
                    </Button>
                    <Button
                      variant="destructive"
                      disabled={busy !== null}
                      leftIcon={<Ban className="h-3.5 w-3.5" />}
                      onClick={() => void decide(question.id, "flagged")}
                    >
                      Flag &amp; hide
                    </Button>
                    <span className="font-mono text-[10px] text-fg-dim">id {question.id.slice(-8)}</span>
                  </div>
                </Card>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>
    </AdminShell>
  );
}
