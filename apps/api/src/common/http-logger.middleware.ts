import type { NextFunction, Request, Response } from 'express';
import { logRequest } from './json-logger.js';
import { normalizeRoute, recordHttpRequest } from './metrics.js';

/**
 * Structured access log + RED metrics for every request.
 * - One JSON line per request on stdout (machine-parseable, no Nest decoration).
 * - Prometheus counters/histograms scraped at /metrics (route labels are
 *   id-normalized to bound cardinality).
 */
export function httpLoggerMiddleware(req: Request, res: Response, next: NextFunction): void {
  const start = Date.now();
  res.on('finish', () => {
    const ms = Date.now() - start;
    const user = (req as unknown as { auth?: { userId?: string } }).auth?.userId ?? 'anon';
    const route = normalizeRoute((req.originalUrl ?? req.url ?? '').split('?')[0]);
    recordHttpRequest(req.method, route, res.statusCode, ms);
    logRequest({
      method: req.method,
      path: req.originalUrl,
      status: res.statusCode,
      ms,
      requestId: (req as unknown as { requestId?: string }).requestId,
      user,
      ip: req.ip,
    });
  });
  next();
}
