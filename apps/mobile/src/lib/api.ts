/**
 * Minimal API client — same contract as apps/web/src/lib/api.ts.
 * Auth: paste a Clerk session token (Profile → dev settings) until
 * react-native Clerk integration lands (Phase 7 follow-up).
 */
const API_URL =
  (typeof process !== "undefined" ? process.env.EXPO_PUBLIC_API_URL : undefined) ??
  "http://localhost:4000";

declare const process: { env: Record<string, string | undefined> };

export interface QuestionDTO {
  id: string;
  topic: string;
  difficulty: string;
  type: "mcq" | "short_answer" | "code";
  prompt: string;
  options?: string[];
}

export async function apiFetch<T>(path: string, token?: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...init?.headers,
    },
  });
  if (!res.ok) throw new Error(`API ${res.status}: ${await res.text()}`);
  return (await res.json()) as T;
}
