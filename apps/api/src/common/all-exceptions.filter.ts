import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import * as Sentry from '@sentry/node';
import { logError, logWarn } from './json-logger.js';
import { normalizeRoute } from './metrics.js';

/**
 * Single exit point for every error response (spec-adjacent: enterprise
 * observability + predictable error contract).
 *
 * - Preserves the existing JSON contract (`statusCode`, `error`, plus feature
 *   fields like `feature`/`limit`/`resetAt`) so current clients keep working.
 * - Adds `requestId` and `path` for support/debugging.
 * - Never leaks internal messages/stacks for unexpected 5xx errors.
 * - Reports 5xx to Sentry (when SENTRY_DSN is configured) with the request id.
 */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const res = ctx.getResponse<Response>();
    const req = ctx.getRequest<Request>();

    const isHttp = exception instanceof HttpException;
    const status = isHttp ? exception.getStatus() : HttpStatus.INTERNAL_SERVER_ERROR;
    const requestId = req.requestId;

    let body: Record<string, unknown>;
    if (isHttp) {
      const payload = exception.getResponse();
      if (typeof payload === 'string') {
        body = { statusCode: status, error: payload };
      } else if (payload && typeof payload === 'object') {
        body = { ...(payload as Record<string, unknown>) };
        // Normalize Nest's default { message } shape into our `error` field.
        if (typeof body.error !== 'string' && typeof body.message === 'string') {
          body.error = body.message;
        }
      } else {
        body = { statusCode: status, error: 'Request failed' };
      }
    } else {
      body = { statusCode: status, error: 'Internal server error' };
    }

    body.statusCode = status;
    body.requestId = requestId;
    body.path = req.originalUrl;

    if (status >= 500) {
      const err = exception instanceof Error ? exception : new Error(String(exception));
      logError({
        method: req.method,
        path: req.originalUrl,
        status,
        requestId,
        error: err.message,
        stack: err.stack,
      });
      if (process.env.SENTRY_DSN) {
        Sentry.withScope((scope) => {
          scope.setTag('request_id', requestId ?? 'unknown');
          scope.setTag('http_status', String(status));
          scope.setExtra('path', req.originalUrl);
          Sentry.captureException(err);
        });
      }
    } else if (status >= 400 && !isHttp) {
      logWarn('unhandled_client_error', {
        method: req.method,
        path: normalizeRoute(req.originalUrl ?? ''),
        status,
        requestId,
      });
    }

    if (res.headersSent) {
      res.end();
      return;
    }
    res.status(status).json(body);
  }
}
