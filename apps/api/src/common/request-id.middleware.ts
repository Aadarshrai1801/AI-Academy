import { randomUUID } from 'crypto';
import type { NextFunction, Request, Response } from 'express';

export const REQUEST_ID_HEADER = 'x-request-id';

declare module 'express-serve-static-core' {
  interface Request {
    requestId?: string;
  }
}

/**
 * Correlation id for every request: reuses an inbound `x-request-id`
 * (load balancers, clients, or the web app) and always echoes it back.
 * Logs and 5xx responses include it so support can trace one request across
 * API logs, Sentry, and the browser network tab.
 */
export function requestIdMiddleware(req: Request, res: Response, next: NextFunction): void {
  const incoming = req.headers[REQUEST_ID_HEADER];
  const id =
    (Array.isArray(incoming) ? incoming[0] : incoming)?.trim().slice(0, 128) || randomUUID();
  req.requestId = id;
  res.setHeader(REQUEST_ID_HEADER, id);
  next();
}
