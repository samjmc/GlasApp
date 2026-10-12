import type { Logger } from 'pino';
import pinoHttp from 'pino-http';
import type { Request, Response } from 'express';

/**
 * One structured log line per request (not for the health probes): method, path, status, duration
 * and request id.
 *
 * The default request serializer logs the whole URL, query string included, and every header. A
 * password-reset link (`/auth/reset-password?token_hash=…`) and an OAuth return (`/auth/callback?code=…`)
 * carry one-time credentials in the query, so anyone reading the logs could redeem them; the headers add
 * the visitor's user agent to their IP. So the request is logged as its path only, with the client address.
 */
export function createHttpLogger(logger: Logger) {
  return pinoHttp<Request, Response>({
    logger,
    autoLogging: {
      ignore: (req) => req.url?.startsWith('/health') || req.url?.startsWith('/_health') || false,
    },
    serializers: {
      req: (req: { id: unknown; method: string; url: string; remoteAddress?: string }) => ({
        id: req.id,
        method: req.method,
        url: String(req.url).split('?')[0],
        remoteAddress: req.remoteAddress,
      }),
    },
    customLogLevel: (_req, res, err) => {
      if (err || res.statusCode >= 500) return 'error';
      if (res.statusCode >= 400) return 'warn';
      return 'info';
    },
    customProps: (req) => ({
      route: `${req.method} ${(req.originalUrl || req.url || '').split('?')[0]}`,
      userId: (req as { user?: { id?: string } }).user?.id ?? undefined,
    }),
  });
}
