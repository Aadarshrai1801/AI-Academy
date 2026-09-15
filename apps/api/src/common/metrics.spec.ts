import {
  HISTO_BUCKETS,
  incCounter,
  normalizeRoute,
  observeHistogram,
  recordHttpRequest,
  renderMetrics,
  resetMetricsForTest,
} from './metrics.js';

describe('metrics registry', () => {
  beforeEach(() => resetMetricsForTest());

  it('increments counters and renders Prometheus exposition format', () => {
    expect(incCounter('api_quota_denied_total', { feature: 'ai_text' })).toBe(1);
    incCounter('api_quota_denied_total', { feature: 'ai_text' });
    incCounter('api_jobs_failed_total', { queue: 'question-gen' });

    const out = renderMetrics();
    expect(out).toContain('# HELP api_quota_denied_total');
    expect(out).toContain('# TYPE api_quota_denied_total counter');
    expect(out).toContain('api_quota_denied_total{feature="ai_text"} 2');
    expect(out).toContain('api_jobs_failed_total{queue="question-gen"} 1');
    // Deterministic trailing newline.
    expect(out.endsWith('\n')).toBe(true);
  });

  it('renders histogram buckets, +Inf, sum and count', () => {
    observeHistogram('http_request_duration_seconds', { method: 'GET', route: '/health' }, 0.02);
    observeHistogram('http_request_duration_seconds', { method: 'GET', route: '/health' }, 0.3);

    const out = renderMetrics();
    expect(out).toContain('# TYPE http_request_duration_seconds histogram');
    const lines = out.split('\n');
    const le25 = lines.find((l) => l.includes('le="0.25"') && l.includes('http_request_duration_seconds'));
    const leInf = lines.find((l) => l.includes('le="+Inf"'));
    const sum = lines.find((l) => l.includes('http_request_duration_seconds_sum'));
    const count = lines.find((l) => l.includes('http_request_duration_seconds_count'));
    // 0.02 ≤ 0.25, 0.3 > 0.25 → bucket 0.25 counts one observation.
    expect(le25).toContain(' 1');
    expect(leInf).toContain(' 2');
    expect(sum).toContain('0.32');
    expect(count).toContain(' 2');
    // All standard buckets present.
    for (const b of HISTO_BUCKETS) {
      expect(out).toContain(`le="${b}"`);
    }
  });

  it('always emits process gauges with a stable series set', () => {
    const out = renderMetrics();
    expect(out).toContain('# TYPE process_uptime_seconds gauge');
    expect(out).toMatch(/process_uptime_seconds \d+/);
    expect(out).toMatch(/process_resident_memory_bytes \d+/);
    expect(out).toMatch(/nodejs_heap_used_bytes \d+/);
    expect(out).toMatch(/nodejs_eventloop_lag_p99_seconds \d/);
    // Second render is stable (headers not duplicated).
    expect(renderMetrics().match(/# TYPE process_uptime_seconds/g)?.length).toBe(1);
  });

  it('normalizes id-like route segments to bound label cardinality', () => {
    expect(normalizeRoute('/ai/videos/650a1f2b3c4d5e6f7a8b9c0d')).toBe('/ai/videos/:id');
    expect(normalizeRoute('/calls/12345')).toBe('/calls/:id');
    expect(normalizeRoute('/groups/abc123/messages')).toBe('/groups/abc123/messages');
    expect(normalizeRoute('/health')).toBe('/health');
  });

  it('recordHttpRequest feeds counters and histograms', () => {
    recordHttpRequest('POST', '/attempts', 200, 250);
    const out = renderMetrics();
    expect(out).toContain('http_requests_total{method="POST",route="/attempts",status="200"} 1');
    expect(out).toContain('http_request_duration_seconds_count{method="POST",route="/attempts"} 1');
  });

  it('escapes quotes and backslashes in label values', () => {
    incCounter('weird', { q: 'a"b\\c' });
    expect(renderMetrics()).toContain('weird{q="a\\"b\\\\c"} 1');
  });
});