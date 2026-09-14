/**
 * Minimal API client — same contract as apps/web/src/lib/api.ts.
 * Auth: paste a Clerk session token (Profile → dev settings) until
 * react-native Clerk integration lands (Phase 7 follow-up).
 * NOTE: token is kept in memory only, never persisted to disk.
 */
const RAW_URL =
  (typeof process !== "undefined" ? process.env.EXPO_PUBLIC_API_URL : undefined) ??
  "http://localhost:4000";
export const API_URL = RAW_URL.replace(/\/$/, "");

declare const process: { env: Record<string, string | undefined> };

const DEFAULT_TIMEOUT_MS = 15_000;

function requestId(): string {
  try {
    return `${Date.now().toString(36)}-${Math.floor(Math.random() * 1e9).toString(36)}`;
  } catch {
    return `mobile-${Date.now().toString(36)}`;
  }
}

export class ApiError extends Error {
  status: number;
  payload: unknown;
  requestId?: string;
  constructor(status: number, payload: unknown, requestIdValue?: string) {
    super(typeof payload === "string" ? payload : `API error ${status}`);
    this.status = status;
    this.payload = payload;
    this.requestId = requestIdValue;
  }
}

export interface QuestionDTO {
  id: string;
  topic: string;
  difficulty: string;
  type: "mcq" | "short_answer" | "code";
  prompt: string;
  options?: string[];
}

export async function apiFetch<T>(path: string, token?: string, init?: RequestInit): Promise<T> {
  const id = requestId();
  let res: Response;
  try {
    res = await fetch(`${API_URL}${path}`, {
      ...init,
      signal: init?.signal ?? AbortSignal.timeout(DEFAULT_TIMEOUT_MS),
      headers: {
        "Content-Type": "application/json",
        "x-request-id": id,
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...init?.headers,
      },
    });
  } catch (e) {
    throw new ApiError(0, e instanceof Error ? e.message : "Network request failed", id);
  }
  if (!res.ok) {
    let payload: unknown = res.statusText;
    try {
      payload = await res.json();
    } catch {
      try {
        payload = await res.text();
      } catch {
        payload = res.statusText;
      }
    }
    const safe = typeof payload === "string" ? payload.slice(0, 300) : payload;
    throw new ApiError(res.status, safe, id);
  }
  try {
    return (await res.json()) as T;
  } catch {
    throw new ApiError(res.status, "Invalid JSON response", id);
  }
}
