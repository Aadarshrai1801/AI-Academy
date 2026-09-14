// Trailing slash stripped: Vercel envs like `https://...onrender.com/` plus
// paths like `/questions/next` otherwise produce `//questions/next`, which
// Express won't route (and the resulting 404 carries no CORS headers,
// surfacing as a misleading CORS error in the browser).
export const API_URL = (
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000"
).replace(/\/$/, "");

/** Per-request timeout: a hung API must not hang the UI forever. */
const DEFAULT_TIMEOUT_MS = 15_000;
/** Retry only idempotent requests on transient upstream failures. */
const RETRYABLE_STATUS = new Set([502, 503, 504, 429, 408]);
const MAX_GET_ATTEMPTS = 3;
const BASE_RETRY_DELAY_MS = 400;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
const jitter = (ms: number) => ms + Math.floor(Math.random() * ms);

function retryDelayMs(attempt: number, retryAfter: string | null): number {
  if (retryAfter) {
    const secs = Number(retryAfter);
    if (Number.isFinite(secs) && secs >= 0 && secs <= 60) return secs * 1000;
    const dateMs = Date.parse(retryAfter);
    if (!Number.isNaN(dateMs)) return Math.max(0, Math.min(60_000, dateMs - Date.now()));
  }
  return jitter(BASE_RETRY_DELAY_MS * 2 ** (attempt - 1));
}

/** Generate an idempotency key for non-idempotent POSTs (attempts/checkout/video). */
export function idempotencyKey(): string {
  return requestId();
}

function requestId(): string {
  try {
    return crypto.randomUUID();
  } catch {
    return `web-${Date.now().toString(36)}`;
  }
}

export interface QuestionDTO {
  id: string;
  topic: string;
  subtopic?: string;
  difficulty: "easy" | "medium" | "hard";
  type: "mcq" | "short_answer" | "code";
  prompt: string;
  options?: string[];
  repeated?: boolean;
}

export interface AttemptResultDTO {
  attemptId: string;
  isCorrect: boolean;
  pointsAwarded: number;
  correctAnswer: string;
  explanation: string;
  dailyScore: number;
  streak: { current: number; longest: number; todayCount: number };
}

export interface SummaryDTO {
  today: { attempts: number; correct: number; score: number; accuracy: number | null };
  total: { points: number };
  streak: { current: number; longest: number; todayCount: number };
  rank: { rank: number | null; score: number };
  role: string;
  username: string | null;
}

export interface BoardEntry {
  rank: number;
  userId: string;
  username: string;
  score: number;
}

export interface QuotaState {
  allowed: boolean;
  remaining: number;
  limit: number;
  feature: string;
  resetAt?: string;
}

/**
 * Thrown for API errors; `status===429` drives the paywall modal (spec §2.1 edge).
 * `status===0` means the request never reached the API (network/timeout), and
 * `requestId` lets support correlate with API logs (shown in error UIs).
 */
export class ApiError extends Error {
  status: number;
  payload: Record<string, unknown>;
  requestId?: string;
  constructor(status: number, payload: Record<string, unknown>, requestIdValue?: string) {
    super((payload.error as string) ?? `API error ${status}`);
    this.status = status;
    this.payload = payload;
    this.requestId = requestIdValue;
  }
}

export interface ApiFetchOptions {
  token?: string | null;
  method?: string;
  body?: unknown;
  /** Override the 15s default timeout. */
  timeoutMs?: number;
  /** Send Idempotency-Key header on POST (server persists it for billing/attempts). */
  idempotencyKey?: string;
}

export async function apiFetch<T>(path: string, opts: ApiFetchOptions = {}): Promise<T> {
  const method = opts.method ?? "GET";
  // Only retry idempotent methods; a retried POST could double-charge quota.
  const idempotent = method === "GET" || method === "HEAD";
  const maxAttempts = idempotent ? MAX_GET_ATTEMPTS : 1;
  const id = requestId();
  const url = `${API_URL}${path}`;

  let lastError: unknown;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const res = await fetch(url, {
        method,
        cache: "no-store",
        signal: AbortSignal.timeout(opts.timeoutMs ?? DEFAULT_TIMEOUT_MS),
        headers: {
          "Content-Type": "application/json",
          "x-request-id": id,
          ...(opts.token ? { Authorization: `Bearer ${opts.token}` } : {}),
          ...(opts.idempotencyKey ? { "Idempotency-Key": opts.idempotencyKey } : {}),
        },
        ...(opts.body !== undefined ? { body: JSON.stringify(opts.body) } : {}),
      });

      if (!res.ok) {
        let payload: Record<string, unknown> = {};
        try {
          payload = (await res.json()) as Record<string, unknown>;
        } catch {
          payload = { error: res.statusText };
        }
        // Transient upstream failures: exponential backoff + honor Retry-After.
        if (idempotent && RETRYABLE_STATUS.has(res.status) && attempt < maxAttempts) {
          await sleep(retryDelayMs(attempt, res.headers.get("Retry-After")));
          continue;
        }
        if (res.status >= 500) {
          console.error(`[api] ${method} ${path} → ${res.status} (requestId=${id})`, payload);
        }
        throw new ApiError(res.status, payload, id);
      }
      return (await res.json()) as T;
    } catch (e) {
      if (e instanceof ApiError) throw e;
      lastError = e;
      const timedOut = e instanceof DOMException && e.name === "TimeoutError";
      if (idempotent && attempt < maxAttempts && !timedOut) {
        await sleep(retryDelayMs(attempt, null));
        continue;
      }
      // Network failure (API down, CORS blocked, offline, timeout). Throw
      // ApiError with status 0 so callers can handle it uniformly.
      console.error(`[api] ${method} ${path} failed (requestId=${id})`, e);
      throw new ApiError(
        0,
        {
          error: timedOut
            ? `The API did not respond in time (${API_URL}).`
            : `Cannot reach API at ${API_URL}. Is the backend running (npm run dev:api)?`,
        },
        id,
      );
    }
  }
  // Unreachable in practice (the loop either returns or throws), but keeps TS happy.
  throw lastError instanceof Error ? lastError : new Error("Request failed");
}

export async function apiHealth(): Promise<string> {
  const res = await fetch(`${API_URL}/health`, {
    cache: "no-store",
    signal: AbortSignal.timeout(5000),
  });
  if (!res.ok) throw new Error(`API health failed: ${res.status}`);
  const data = (await res.json()) as { status?: string };
  return data.status ?? "unknown";
}

export const TOPICS = [
  "ml-basics",
  "statistics",
  "neural-networks",
  "deep-learning",
  "llms",
  "evaluation",
] as const;

// ── Phase 3: social ─────────────────────────────────────────────────────

export interface GroupDTO {
  id: string;
  name: string;
  owner_id: string;
  privacy: "invite_only" | "public";
  member_count: number;
  max_members: number;
  invite_code: string;
  invite_code_expires_at?: string;
  member_ids: string[];
}

export interface ChatMessage {
  id: string;
  group_id: string;
  sender_id: string;
  type: "text" | "image" | "file" | "question_share";
  content: string;
  question_id?: string;
  edited_at?: string;
  read_by: string[];
  reactions: Record<string, string[]>;
  flagged?: boolean;
  created_at: string;
}

export interface GroupBoardEntry {
  rank: number;
  userId: string;
  score: number;
}

// ── Phase 4: AI Q&A ───────────────────────────────────────────────────────

export interface YoutubeRec {
  video_id: string;
  title: string;
  thumbnail_url: string;
  channel: string;
}

export interface AskResult {
  id: string;
  question: string;
  answer: string;
  cached: boolean;
  video_status: string;
  youtube: YoutubeRec[];
  quota?: { remaining: number; limit: number };
}

export interface AskHistoryItem {
  id: string;
  question: string;
  cached: boolean;
  onTopic: boolean;
  youtubeCount: number;
  at: string;
}

// ── Phase 5: explainer videos ─────────────────────────────────────────────

export interface VideoJobDTO {
  id: string;
  status: "queued" | "generating" | "ready" | "failed";
  stage: string;
  progress: number;
  videoUrl: string | null;
  fileToken: { url: string; expiresAt: string } | null;
  script?: {
    title: string;
    scenes: Array<{ heading: string; bullets: string[]; narration: string; durationSec: number }>;
  };
  durationSec?: number;
  error?: string;
  createdAt?: string;
}

export interface VideoRequestResult {
  cached: boolean;
  jobId: string;
  status: string;
  videoUrl: string | null;
}

// ── Phase 6: video calls ──────────────────────────────────────────────────

export interface CallDTO {
  id: string;
  initiator_id: string;
  invitee_id: string | null;
  group_id: string | null;
  type: "1:1" | "group";
  status: "active" | "completed" | "missed" | "failed";
  participant_ids: string[];
  duration_sec: number;
  screen_share_used: boolean;
  flagged?: boolean;
  started_at?: string;
  ended_at?: string;
  capMinutes?: number;
  sfu?: boolean;
}

export interface JoinResult {
  call: CallDTO;
  token: string | null;
  provider?: "rtk" | null;
}

// ── Phase 7: history + analytics ──────────────────────────────────────────

export interface HistoryPoint {
  day: string;
  rank: number | null;
  score: number;
  accuracy: number | null;
  of: number;
  percentile?: number | null;
  top?: BoardEntry[];
}

export interface DayPoint {
  day: string;
  attempts: number;
  correct: number;
  score: number;
  accuracy: number | null;
}

export interface TopicStat {
  topic: string;
  attempts: number;
  correct: number;
  score: number;
  accuracy: number | null;
}

export interface AnalyticsDTO {
  daily: DayPoint[];
  topics: TopicStat[];
  totals: { attempts: number; correct: number; score: number; accuracy: number | null };
  compare?: { rank: number | null; of: number; percentile: number | null; avgScoreToday: number | null };
}

// ── Phase 2: generation + admin ─────────────────────────────────────────

export interface GenStatusDTO {
  provider: string;
  target: number;
  budget: { used: number; daily: number };
  jobs: Record<string, number> | null;
  bank: Record<string, Record<string, { approved: number; pending: number }>>;
}

export interface ReviewItem {
  id: string;
  topic: string;
  subtopic?: string;
  difficulty: string;
  type: string;
  prompt: string;
  options?: string[];
  correct_answer: string;
  explanation: string;
  source: string;
  generation_model?: string;
  quality_score?: number;
  flag_reason?: string;
}
