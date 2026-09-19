"use client";

import { Infinity as InfinityIcon } from "lucide-react";
import type { QuotaState } from "@/lib/api";
import { Badge, ProgressRing, Skeleton, quotaTone } from "@/components/ui";
import { cn } from "@/lib/cn";

/**
 * Quota indicator (§2.8).
 *
 * Limited plans get a depleting donut that shifts amber → rose as the daily
 * allowance runs out. Unlimited plans get a labeled pill instead of a
 * permanently-full ring, because "100% full forever" communicates nothing.
 * The numeric readout is always present so color is never the only signal
 * (§4).
 */
export function QuotaPill({ quota, className }: { quota: QuotaState | null; className?: string }) {
  if (!quota) {
    return <Skeleton className={cn("h-8 w-24 rounded-full", className)} />;
  }

  const unlimited = quota.limit === -1 || quota.remaining === -1;
  if (unlimited) {
    return (
      <Badge variant="medium" icon={<InfinityIcon className="h-3 w-3" aria-hidden="true" />} className={className}>
        Unlimited
      </Badge>
    );
  }

  const tone = quotaTone(quota.remaining, quota.limit);
  const exhausted = quota.remaining <= 0;
  const resetHint = quota.resetAt
    ? `Resets ${new Date(quota.resetAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}`
    : "Resets 00:00 UTC";

  return (
    <div
      className={cn(
        "flex items-center gap-2 rounded-full border bg-surface-2 py-1 pr-3 pl-1.5 transition-colors",
        exhausted ? "border-error/40 bg-state-negative-soft shadow-glow" : "border-line hover:border-line-strong",
        className,
      )}
      title={`${quota.remaining} of ${quota.limit} questions left today · ${resetHint}`}
    >
      <ProgressRing
        value={quota.remaining}
        max={quota.limit}
        size={22}
        strokeWidth={3}
        tone={tone}
        label={`${quota.remaining} of ${quota.limit} questions left today`}
      />
      <span className="font-mono text-xs font-medium tabular-nums text-fg">
        {quota.remaining}
        <span className="text-fg-dim">/{quota.limit}</span>
      </span>
    </div>
  );
}
