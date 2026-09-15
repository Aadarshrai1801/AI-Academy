/**
 * Structured JSON logging — one parseable object per line on stdout.
 *
 * Replaces NestJS's pretty-printed Logger on the request hot path so log
 * shippers (Datadog/Loki/CloudWatch) can ingest every line without
 * regex-parsing Nest's `Nest [Context]` decoration around the JSON payload.
 * Internal errors still go to Sentry; non-JSON human logs remain elsewhere.
 */

/** Best-effort PII minimization: never log raw querystrings (may carry tokens). */
const safePath = (p: string | undefined): string => (p ?? '').split('?')[0];

export function writeLine(obj: Record<string, unknown>): void {
  try {
    process.stdout.write(`${JSON.stringify(obj)}\n`);
  } catch {
    /* logging must never break the request */
  }
}

export function logRequest(fields: {
  method: string;
  path: string;
  status: number;
  ms: number;
  requestId?: string;
  user?: string;
  ip?: string;
}): void {
  writeLine({
    msg: 'request',
    severity: 'info',
    time: new Date().toISOString(),
    method: fields.method,
    path: safePath(fields.path),
    status: fields.status,
    ms: fields.ms,
    requestId: fields.requestId,
    user: fields.user,
    ip: fields.ip,
  });
}

export function logError(fields: {
  msg?: string;
  method?: string;
  path?: string;
  status?: number;
  requestId?: string;
  error: string;
  stack?: string;
}): void {
  writeLine({
    msg: fields.msg ?? 'unhandled_error',
    severity: 'error',
    time: new Date().toISOString(),
    method: fields.method,
    path: safePath(fields.path),
    status: fields.status,
    requestId: fields.requestId,
    error: fields.error,
    ...(fields.stack ? { stack: fields.stack } : {}),
  });
}

export function logWarn(msg: string, extra: Record<string, unknown> = {}): void {
  writeLine({ msg, severity: 'warn', time: new Date().toISOString(), ...extra });
}