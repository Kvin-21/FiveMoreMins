import { Request, Response, NextFunction } from 'express';

interface RateLimitEntry {
  count: number;
  resetAt: number; // unix ms timestamp
}

const WINDOW_MS = 15 * 60 * 1000; // 15 minutes

// In-memory store — good enough for a single-process server.
// Swap for Redis if you ever run multiple instances.
const store = new Map<string, RateLimitEntry>();

// Clean up stale entries every 5 minutes so the map doesn't grow forever
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of store.entries()) {
    if (entry.resetAt < now) {
      store.delete(key);
    }
  }
}, 5 * 60 * 1000).unref(); // unref so the interval doesn't keep the process alive

function checkLimit(key: string, max: number, req: Request, res: Response, next: NextFunction): void {
  const now = Date.now();
  const entry = store.get(key);

  if (!entry || entry.resetAt < now) {
    store.set(key, { count: 1, resetAt: now + WINDOW_MS });
    next();
    return;
  }

  if (entry.count >= max) {
    res.status(429).json({ error: 'Too many requests. Slow down.' });
    return;
  }

  entry.count++;
  next();
}

/**
 * Strict limiter for auth endpoints: 10 requests per IP per 15 minutes.
 * Prevents brute-force magic link farming.
 */
export function authRateLimit(req: Request, res: Response, next: NextFunction): void {
  const ip = req.ip || req.socket.remoteAddress || 'unknown';
  checkLimit(`auth:${ip}`, 10, req, res, next);
}

/**
 * General limiter for all other routes: 100 requests per IP per 15 minutes.
 * A reasonable ceiling for legitimate users while blocking scrapers.
 */
export function generalRateLimit(req: Request, res: Response, next: NextFunction): void {
  const ip = req.ip || req.socket.remoteAddress || 'unknown';
  checkLimit(`general:${ip}`, 100, req, res, next);
}
