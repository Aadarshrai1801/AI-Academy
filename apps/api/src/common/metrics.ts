/**
 * Minimal Prometheus text-format metrics registry (no dependencies).
 *
 * Enterprise need: RED metrics (rate/error/duration) + business counters that
 * a Prometheus/VictoriaMetrics scraper can poll at GET /metrics and alert on.
 * Plain module (no DI) so plain middlewares and workers can record without a
 * container. Series cardinality is capped to protect the process from label
 * explosions.
 */
import { monitorEventLoopDelay } from 'perf_hooks';

const MAX_SERIES = 1000;

type Labels = Record<string, string>;
type MetricType = 'counter' | 'gauge' | 'histogram';

interface MetricMeta {
  help: string;
  type: MetricType;
}

interface HistSeries {
  buckets: Map<number, number>;
  sum: number;
  count: number;
}

export const HISTO_BUCKETS = [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10];

/** Canonical HELP strings for metrics recorded by this service. */
const KNOWN_HELP: Record<string, string> = {
  http_requests_total: 'Total HTTP requests by method, route, and status code.',
  http_request_duration_seconds: 'HTTP request duration in seconds by method and route.',
  api_quota_denied_total: 'Quota enforcement denials by feature (drives 429 responses).',
  api_redis_failures_total: 'Redis operation failures by component — page-worthy in multi-instance deployments.',
  api_jobs_failed_total: 'Failed background jobs by queue (the failed pile is the DLQ; see OPERATIONS.md).',
};

const meta = new Map<string, MetricMeta>();
const counters = new Map<string, number>();
const gauges = new Map<string, number>();
const histograms = new Map<string, HistSeries>();

/** Serialize + sort labels so series keys are deterministic. */
const labelKey = (name: string, labels: Labels = {}): string => {
  const pairs = Object.entries(labels)
    .map(([k, v]) => k + '="' + String(v).replace(/\\/g, '\\\\').replace(/"/g, '\\"') + '"')
    .sort();
  return pairs.length ? name + '{' + pairs.join(',') + '}' : name;
};

const totalSeries = (): number => counters.size + gauges.size + histograms.size;

function ensureMeta(name: string, type: MetricType): void {
  if (!meta.has(name)) meta.set(name, { type, help: KNOWN_HELP[name] ?? `${name} (auto-registered metric)` });
}

/** Increment a counter series. Returns the new value (test-friendly). */
export function incCounter(name: string, labels: Labels = {}, value = 1): number {
  ensureMeta(name, 'counter');
  const key = labelKey(name, labels);
  if (totalSeries() >= MAX_SERIES && !counters.has(key)) return counters.get(key) ?? 0;
  const next = (counters.get(key) ?? 0) + value;
  counters.set(key, next);
  return next;
}

export function setGauge(name: string, value: number, labels: Labels = {}): void {
  ensureMeta(name, 'gauge');
  const key = labelKey(name, labels);
  if (totalSeries() >= MAX_SERIES && !gauges.has(key)) return;
  gauges.set(key, value);
}

/** Observe a value (seconds) into a histogram with +Inf bucket semantics. */
export function observeHistogram(name: string, labels: Labels, valueSeconds: number): void {
  ensureMeta(name, 'histogram');
  const key = labelKey(name, labels);
  let h = histograms.get(key);
  if (!h) {
    if (totalSeries() >= MAX_SERIES) return;
    h = { buckets: new Map(HISTO_BUCKETS.map((b) => [b, 0])), sum: 0, count: 0 };
    histograms.set(key, h);
  }
  for (const b of HISTO_BUCKETS) {
    if (valueSeconds <= b) h.buckets.set(b, (h.buckets.get(b) ?? 0) + 1);
  }
  h.sum += valueSeconds;
  h.count += 1;
}

// ── HTTP instrumentation ────────────────────────────────────────────────────

/**
 * Collapse high-cardinality path segments (Mongo ids, numeric ids) so `route`
 * labels stay bounded. Unknown shapes pass through unchanged.
 */
export function normalizeRoute(path: string): string {
  return path
    .split('/')
    .map((seg) => {
      if (/^[0-9a-fA-F]{24}$/.test(seg)) return ':id'; // Mongo ObjectId
      if (/^job-?[0-9a-f-]{8,}$/i.test(seg)) return ':id'; // BullMQ job ids
      if (/^\d+$/.test(seg)) return ':id';
      return seg;
    })
    .join('/');
}

export function recordHttpRequest(method: string, route: string, status: number, durationMs: number): void {
  incCounter('http_requests_total', { method, route, status: String(status) });
  observeHistogram('http_request_duration_seconds', { method, route }, durationMs / 1000);
}

// ── Event-loop lag monitor ──────────────────────────────────────────────────

const loopMonitor = monitorEventLoopDelay({ resolution: 20 });
loopMonitor.enable();

// ── Rendering ───────────────────────────────────────────────────────────────

const escapeValue = (v: string): string => v.replace(/\\/g, '\\\\').replace(/"/g, '\\"');

/** Strip a `_bucket`/`_sum`/`_count` suffix to find the metric family meta. */
const familyName = (name: string): string => name.replace(/_(bucket|sum|count)$/, '');

/**
 * Render all metrics in Prometheus text exposition format (version 0.0.4).
 * Process-level gauges are always emitted so scrapers see a stable series set.
 */
export function renderMetrics(): string {
  const lines: string[] = [];
  const emitted = new Set<string>();
  const emitHeader = (family: string): void => {
    if (emitted.has(family)) return;
    const m = meta.get(family);
    lines.push(`# HELP ${family} ${escapeValue(m?.help ?? family)}`);
    lines.push(`# TYPE ${family} ${m?.type ?? 'gauge'}`);
    emitted.add(family);
  };

  for (const [key, value] of counters) {
    emitHeader(familyName(key.split('{')[0]));
    lines.push(`${key} ${value}`);
  }

  for (const [key, h] of histograms) {
    const brace = key.indexOf('{');
    const family = brace === -1 ? key : key.slice(0, brace);
    const labelBody = brace === -1 ? '' : key.slice(brace + 1, -1); // without {}
    emitHeader(family);
    const withLe = (extra: string): string =>
      labelBody ? `${family}{${extra},${labelBody}}` : `${family}{${extra}}`;
    for (const b of HISTO_BUCKETS) {
      lines.push(`${withLe(`le="${b}"`)} ${h.buckets.get(b) ?? 0}`);
    }
    lines.push(`${withLe('le="+Inf"')} ${h.count}`);
    lines.push(`${family}_sum${labelBody ? `{${labelBody}}` : ''} ${h.sum}`);
    lines.push(`${family}_count${labelBody ? `{${labelBody}}` : ''} ${h.count}`);
  }

  for (const [key, value] of gauges) {
    emitHeader(familyName(key.split('{')[0]));
    lines.push(`${key} ${value}`);
  }

  // Process-level gauges (always present so scrapers see a stable series set).
  const mem = process.memoryUsage();
  emitHeader('process_uptime_seconds');
  lines.push(`process_uptime_seconds ${Math.round(process.uptime())}`);
  emitHeader('process_resident_memory_bytes');
  lines.push(`process_resident_memory_bytes ${mem.rss}`);
  emitHeader('nodejs_heap_used_bytes');
  lines.push(`nodejs_heap_used_bytes ${mem.heapUsed}`);
  emitHeader('nodejs_eventloop_lag_p99_seconds');
  lines.push(`nodejs_eventloop_lag_p99_seconds ${(loopMonitor.percentile(99) / 1e9).toFixed(6)}`);

  return `${lines.join('\n')}\n`;
}

/** Test helper: reset all series (never exposed on the metrics endpoint). */
export function resetMetricsForTest(): void {
  counters.clear();
  gauges.clear();
  histograms.clear();
  meta.clear();
}