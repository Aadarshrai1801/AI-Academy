"use client";

import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@clerk/nextjs";
import { motion, useReducedMotion } from "framer-motion";
import { Ban, CircleAlert, Flag, MessageSquare, Phone, RefreshCw, ShieldCheck } from "lucide-react";
import { ApiError, apiFetch } from "@/lib/api";
import { AdminHeader, AdminShell } from "@/components/admin/admin-header";
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  EmptyState,
  SkeletonRow,
  useToast,
} from "@/components/ui";
import { SPRING } from "@/lib/motion";

interface ReportedMessage {
  id: string;
  content: string;
  sender_id: string;
  flag_reason?: string;
}

interface ReportedCall {
  _id: string;
  initiator_id: string;
  flag_reason?: string;
  status: string;
}

/** Compact monogram for an opaque user id (no directory endpoint exists). */
function UserChip({ userId }: { userId: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 font-mono text-[10px] text-fg-dim">
      <span className="grid h-5 w-5 place-items-center rounded-md border border-line bg-surface-3 text-[9px] font-semibold text-fg-muted">
        {userId.replace(/^user_/, "").slice(0, 2).toUpperCase()}
      </span>
      {userId.slice(-8)}
    </span>
  );
}

/**
 * Admin · reports (§ admin surface).
 *
 * Moderation inbox for reported chat messages and calls. Both queues keep their
 * reason visible as a badge rather than buried in a sentence, and each has its
 * own loading, empty and retry state — previously "Clear." was printed as body
 * text, which read as an error rather than a healthy queue.
 */
export default function ReportsPage() {
  const { getToken, isLoaded } = useAuth();
  const toast = useToast();
  const reduced = useReducedMotion();

  const [messages, setMessages] = useState<ReportedMessage[] | null>(null);
  const [calls, setCalls] = useState<ReportedCall[] | null>(null);
  const [failed, setFailed] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const token = await getToken();
      const [messageResult, callResult] = await Promise.all([
        apiFetch<{ items: ReportedMessage[] }>("/admin/reports?limit=50", { token }),
        apiFetch<{ items: ReportedCall[] }>("/admin/call-reports?limit=50", { token }),
      ]);
      setMessages(messageResult.items);
      setCalls(callResult.items);
      setFailed(null);
    } catch (e) {
      setFailed(
        e instanceof ApiError && e.status === 403
          ? "Admin role required."
          : e instanceof Error
            ? `Could not load reports: ${e.message}`
            : "Load failed.",
      );
      setMessages([]);
      setCalls([]);
    }
  }, [getToken]);

  useEffect(() => {
    if (!isLoaded) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [isLoaded, load]);

  return (
    <AdminShell>
      <AdminHeader
        title="Reports"
        description="Moderation inbox for user-reported chat messages and calls. Escalate to a ban from the user's profile if a report is upheld."
        actions={
          <Button
            variant="secondary"
            size="sm"
            leftIcon={<RefreshCw className="h-3.5 w-3.5" />}
            onClick={() => {
              setMessages(null);
              setCalls(null);
              void load();
            }}
          >
            Refresh
          </Button>
        }
      />

      {failed && (
        <div className="mt-6 flex items-center gap-2 rounded-card border border-line-strong bg-surface-2 px-4 py-3 text-xs text-fg">
          <CircleAlert className="h-3.5 w-3.5 shrink-0 text-fg-muted" aria-hidden="true" />
          {failed}
        </div>
      )}

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        {/* Messages */}
        <Card>
          <CardHeader>
            <div>
              <CardTitle className="flex items-center gap-2">
                <MessageSquare className="h-4 w-4 text-fg" aria-hidden="true" />
                Reported messages
              </CardTitle>
              <CardDescription>Chat content flagged by cohort members.</CardDescription>
            </div>
            <Badge variant={messages && messages.length > 0 ? "solid" : "neutral"} size="sm">
              {messages ? messages.length : "—"}
            </Badge>
          </CardHeader>
          <CardContent className="flex flex-col gap-2">
            {messages === null && (
              <div className="flex flex-col">
                <SkeletonRow />
                <SkeletonRow />
              </div>
            )}

            {messages !== null && messages.length === 0 && (
              <EmptyState
                compact
                icon={<ShieldCheck className="h-5 w-5 text-fg-muted" />}
                title="No reported messages"
                description="Nothing in the chat moderation queue right now."
              />
            )}

            {(messages ?? []).map((message) => (
              <motion.article
                key={message.id}
                initial={reduced ? { opacity: 0 } : { opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={SPRING.snappy}
                className="rounded-card border border-line bg-surface-3 p-3.5"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <UserChip userId={message.sender_id} />
                  {message.flag_reason ? (
                    <Badge variant="outline" size="sm" icon={<Flag className="h-3 w-3" aria-hidden="true" />}>
                      {message.flag_reason}
                    </Badge>
                  ) : (
                    <Badge variant="neutral" size="sm">
                      no reason given
                    </Badge>
                  )}
                </div>
                <p className="mt-2.5 text-xs leading-relaxed text-fg">{message.content}</p>
                <div className="mt-3 flex items-center gap-2 border-t border-line pt-2.5">
                  <Button
                    variant="ghost"
                    size="sm"
                    leftIcon={<Ban className="h-3 w-3" />}
                    onClick={() =>
                      toast({
                        title: "Escalation is manual",
                        description: `Message ${message.id.slice(-8)} — take action from the sender's profile.`,
                        variant: "info",
                      })
                    }
                  >
                    Remove &amp; escalate
                  </Button>
                </div>
              </motion.article>
            ))}
          </CardContent>
        </Card>

        {/* Calls */}
        <Card>
          <CardHeader>
            <div>
              <CardTitle className="flex items-center gap-2">
                <Phone className="h-4 w-4 text-fg" aria-hidden="true" />
                Reported calls
              </CardTitle>
              <CardDescription>Call sessions flagged during or after a room.</CardDescription>
            </div>
            <Badge variant={calls && calls.length > 0 ? "solid" : "neutral"} size="sm">
              {calls ? calls.length : "—"}
            </Badge>
          </CardHeader>
          <CardContent className="flex flex-col gap-2">
            {calls === null && (
              <div className="flex flex-col">
                <SkeletonRow />
              </div>
            )}

            {calls !== null && calls.length === 0 && (
              <EmptyState
                compact
                icon={<ShieldCheck className="h-5 w-5 text-fg-muted" />}
                title="No reported calls"
                description="Nothing in the call moderation queue right now."
              />
            )}

            {(calls ?? []).map((call) => (
              <motion.article
                key={call._id}
                initial={reduced ? { opacity: 0 } : { opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={SPRING.snappy}
                className="flex flex-wrap items-center justify-between gap-3 rounded-card border border-line bg-surface-3 p-3.5"
              >
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <UserChip userId={call.initiator_id} />
                    <Badge
                      variant={call.status === "failed" ? "error" : call.status === "missed" ? "warning" : "neutral"}
                      size="sm"
                    >
                      {call.status}
                    </Badge>
                  </div>
                  <p className="mt-1.5 font-mono text-[10px] text-fg-dim">
                    call {call._id.slice(-10)}
                  </p>
                </div>
                {call.flag_reason ? (
                  <Badge variant="warning" size="sm" icon={<Flag className="h-3 w-3" aria-hidden="true" />}>
                    {call.flag_reason}
                  </Badge>
                ) : (
                  <Badge variant="neutral" size="sm">
                    no reason given
                  </Badge>
                )}
              </motion.article>
            ))}
          </CardContent>
        </Card>
      </div>

      <p className="mt-6 font-mono text-[10px] leading-relaxed text-fg-dim">
        User ids are shown truncated because the API exposes no display-name directory for the admin
        surface.
      </p>
    </AdminShell>
  );
}
