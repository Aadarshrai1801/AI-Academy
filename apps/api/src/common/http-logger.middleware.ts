import type { NextFunction, Request, Response } from 'express';
import { Logger } from '@nestjs/common';

/**
 * Minimal structured access log (no new deps).
 * Emits one JSON line per request: method, path, status, duration, requestId, user.
 * Enterprise need: correlatable request logs for support/SLOs without pino/winston.
 */
const logger = new Logger('HTTP');

export function httpLoggerMiddleware(req: Request, res: Response, next: NextFunction): void {
  const start = Date.now();
  res.on('finish', () => {
    const ms = Date.now() - start;
    const user = (req as unknown as { auth?: { userId?: string } }).auth?.userId ?? 'anon';
    logger.log(
      JSON.stringify({
        msg: 'request',
        method: req.method,
        path: req.originalUrl,
        status: res.statusCode,
        ms,
        requestId: (req as unknown as { requestId?: string }).requestId,
        user,
        ip: req.ip,
      }),
    );
  });
  next();
}
