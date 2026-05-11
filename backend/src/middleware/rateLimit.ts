import type { NextFunction, Request, Response } from 'express';

export interface RateLimitOptions {
  windowMs: number;
  max: number;
  keyFn: (req: Request) => string;
  message?: string;
}

interface Bucket {
  count: number;
  resetAt: number;
}

export function createRateLimiter(opts: RateLimitOptions) {
  const buckets = new Map<string, Bucket>();

  return function rateLimit(req: Request, res: Response, next: NextFunction): void {
    const key = opts.keyFn(req);
    if (!key) {
      next();
      return;
    }
    const now = Date.now();
    let bucket = buckets.get(key);
    if (!bucket || bucket.resetAt <= now) {
      bucket = { count: 0, resetAt: now + opts.windowMs };
      buckets.set(key, bucket);
    }

    bucket.count += 1;
    const remaining = Math.max(0, opts.max - bucket.count);
    const resetSeconds = Math.ceil((bucket.resetAt - now) / 1000);
    res.setHeader('X-RateLimit-Limit', String(opts.max));
    res.setHeader('X-RateLimit-Remaining', String(remaining));
    res.setHeader('X-RateLimit-Reset', String(resetSeconds));

    if (bucket.count > opts.max) {
      res.setHeader('Retry-After', String(resetSeconds));
      res.status(429).json({
        error: opts.message ?? 'Too many requests',
        retryAfterSeconds: resetSeconds,
      });
      return;
    }

    if (buckets.size > 5000) {
      for (const [k, v] of buckets) {
        if (v.resetAt <= now) buckets.delete(k);
      }
    }

    next();
  };
}

export function ipKey(req: Request): string {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string' && forwarded.length > 0) {
    return forwarded.split(',')[0].trim();
  }
  return req.ip ?? req.socket.remoteAddress ?? 'unknown';
}

export function userKey(req: Request): string {
  return req.user?.id ?? ipKey(req);
}

export function tokenKey(req: Request): string {
  return (req as Request & { tokenId?: string }).tokenId ?? ipKey(req);
}
