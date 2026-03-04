import { Request, Response, NextFunction } from 'express';

interface RateLimitEntry {
  count: number;
  resetAt: number; // unix ms timestamp
}

const WINDOW_MS = 15 * 60 * 1000; // 15 minutes
const MAX_REQUESTS = 10;

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

export function authRateLimit(req: Request, res: Response, next: NextFunction): void {
  const ip = req.ip || req.socket.remoteAddress || 'unknown';
  const now = Date.now();

  const entry = store.get(ip);

  if (!entry || entry.resetAt < now) {
    // First request in this window (or window expired)
    store.set(ip, { count: 1, resetAt: now + WINDOW_MS });
    next();
    return;
  }

  if (entry.count >= MAX_REQUESTS) {
    res.status(429).json({
      error: 'Too many requests. Slow down — ironically, this is a focus app.',
    });
    return;
  }

  entry.count++;
  next();
}
