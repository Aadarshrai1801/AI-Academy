import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';

/**
 * Keep-alive pinger for free-tier hosts (e.g. Render) that suspend the
 * process after ~15 min without inbound traffic.
 *
 * How it works: every KEEPALIVE_INTERVAL_MS (default 10 min) this service
 * GETs `<public-url>/health`. Any inbound request resets the host's idle
 * timer, so steady pings keep the service warm and `/attempts/me` never
 * surfaces as `Failed to fetch` from a cold boot.
 *
 * Honest limitation: a FULLY suspended process runs no code — not even this
 * timer. So this self-ping only helps once *something* wakes the service.
 * The real wake-up call is external: `.github/workflows/keepalive.yml`
 * curls /health every 10 min from GitHub Actions. Set that workflow's
 * RENDER_API_URL secret and leave this service on as a second layer
 * (it also keeps NAT/connection pools warm between real requests).
 *
 * Zero-config on Render: RENDER_EXTERNAL_URL is injected automatically.
 * Env:
 *   KEEPALIVE_ENABLED=false   → disable (default: enabled, except in tests)
 *   KEEPALIVE_URL=...         → override public base URL
 *   KEEPALIVE_INTERVAL_MS=... → default 600000 (10 min), min 60000
 */
const DEFAULT_INTERVAL_MS = 10 * 60 * 1000;
const MIN_INTERVAL_MS = 60 * 1000;

@Injectable()
export class KeepaliveService implements OnModuleInit, OnModuleDestroy {
  private timer: NodeJS.Timeout | null = null;

  onModuleInit() {
    if (process.env.NODE_ENV === 'test' || process.env.KEEPALIVE_ENABLED === 'false') return;
    const base = (process.env.KEEPALIVE_URL ?? process.env.RENDER_EXTERNAL_URL ?? '').replace(/\/$/, '');
    if (!base) {
      // eslint-disable-next-line no-console
      console.log('[keepalive] no public URL (KEEPALIVE_URL/RENDER_EXTERNAL_URL) — internal ping off; external Action still applies.');
      return;
    }
    const raw = Number(process.env.KEEPALIVE_INTERVAL_MS);
    const interval = Number.isFinite(raw) && raw > 0 ? Math.max(raw, MIN_INTERVAL_MS) : DEFAULT_INTERVAL_MS;
    // Initial delay = full interval so boot isn't slowed by a self-request.
    this.timer = setInterval(() => void this.ping(base), interval);
    this.timer.unref?.();
    // eslint-disable-next-line no-console
    console.log(`[keepalive] pinging ${base}/health every ${Math.round(interval / 60000)} min`);
  }

  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }

  private async ping(base: string) {
    try {
      const res = await fetch(`${base}/health`, { signal: AbortSignal.timeout(15000) });
      if (!res.ok) {
        // eslint-disable-next-line no-console
        console.warn(`[keepalive] ping HTTP ${res.status}`);
      }
    } catch (err) {
      // Never throw — a failed ping must not crash the API.
      // eslint-disable-next-line no-console
      console.warn('[keepalive] ping failed:', (err as Error).message);
    }
  }
}
