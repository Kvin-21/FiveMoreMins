import rateLimit from 'express-rate-limit';

const WINDOW_MS = 15 * 60 * 1000; // 15 minutes

/**
 * Strict limiter for auth endpoints: 10 requests per IP per 15 minutes.
 * Prevents brute-force magic link farming.
 */
export const authRateLimit = rateLimit({
  windowMs: WINDOW_MS,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests. Slow down.' },
});

/**
 * General limiter for all other routes: 100 requests per IP per 15 minutes.
 * A reasonable ceiling for legitimate users while blocking scrapers.
 */
export const generalRateLimit = rateLimit({
  windowMs: WINDOW_MS,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests. Slow down.' },
});
