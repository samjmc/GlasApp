import type { NextFunction, Request, RequestHandler, Response } from 'express';
import { logger } from '../utils/logger';

/**
 * Minimal in-process fixed-window rate limiter.
 *
 * Keyed by client IP (`req.ip`; `trust proxy` is set in server/index.ts so this
 * is the real client behind the Replit proxy). Only counts requests whose method
 * is in `methods` (default: everything except GET/HEAD/OPTIONS), so a limiter
 * mounted on a router that also serves public reads leaves the reads alone.
 *
 * State lives in this process: with more than one replica each replica keeps its
 * own counters, so the effective limit is `max * replicas`. That is acceptable
 * for what this protects (LLM cost, anonymous vote stuffing) and avoids a Redis
 * dependency. Swap the store when the app runs multi-instance.
 */
export interface RateLimitOptions {
  /** Window length in milliseconds. */
  windowMs: number;
  /** Requests allowed per key per window. */
  max: number;
  /** Label used in logs and the 429 body. */
  name: string;
  /** HTTP methods that count. Default: every method except GET/HEAD/OPTIONS. */
  methods?: string[];
}

interface Bucket {
  count: number;
  resetAt: number;
}

const SWEEP_THRESHOLD = 10_000;

export function createRateLimit(options: RateLimitOptions): RequestHandler {
  const { windowMs, max, name } = options;
  const methods = options.methods ? new Set(options.methods.map((m) => m.toUpperCase())) : null;
  const buckets = new Map<string, Bucket>();

  function counts(method: string): boolean {
    if (methods) return methods.has(method.toUpperCase());
    return !['GET', 'HEAD', 'OPTIONS'].includes(method.toUpperCase());
  }

  function sweep(now: number): void {
    if (buckets.size < SWEEP_THRESHOLD) return;
    buckets.forEach((bucket, key) => {
      if (bucket.resetAt <= now) buckets.delete(key);
    });
  }

  return (req: Request, res: Response, next: NextFunction) => {
    if (!counts(req.method)) return next();

    const now = Date.now();
    const key = req.ip || req.socket?.remoteAddress || 'unknown';
    let bucket = buckets.get(key);

    if (!bucket || bucket.resetAt <= now) {
      sweep(now);
      bucket = { count: 0, resetAt: now + windowMs };
      buckets.set(key, bucket);
    }

    bucket.count += 1;
    res.setHeader('X-RateLimit-Limit', String(max));
    res.setHeader('X-RateLimit-Remaining', String(Math.max(0, max - bucket.count)));

    if (bucket.count > max) {
      const retryAfterSeconds = Math.max(1, Math.ceil((bucket.resetAt - now) / 1000));
      res.setHeader('Retry-After', String(retryAfterSeconds));
      logger.warn(
        { limiter: name, route: `${req.method} ${req.path}`, ip: key, count: bucket.count, max },
        'Rate limit exceeded'
      );
      res.status(429).json({
        success: false,
        message: 'Too many requests. Please try again later.',
        retryAfterSeconds,
      });
      return;
    }

    next();
  };
}

const FIFTEEN_MINUTES = 15 * 60 * 1000;

/** Endpoints that call an LLM per request: 30 calls per IP per 15 minutes. */
export const aiRateLimit = createRateLimit({ windowMs: FIFTEEN_MINUTES, max: 30, name: 'ai' });

/** Anonymous public writes (e.g. TD ratings): 60 per IP per 15 minutes. */
export const publicWriteRateLimit = createRateLimit({
  windowMs: FIFTEEN_MINUTES,
  max: 60,
  name: 'public-write',
});
