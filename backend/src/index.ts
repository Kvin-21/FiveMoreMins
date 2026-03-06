import express from 'express';
import cors from 'cors';
import session from 'express-session';
import rateLimit from 'express-rate-limit';
import cookieParser from 'cookie-parser';
import path from 'path';
import dotenv from 'dotenv';
import { doubleCsrf } from 'csrf-csrf';

// Load env vars before anything else
dotenv.config();

// Initialize DB (auto-creates tables)
import './db';

// Import routes
import authRoutes from './routes/auth';
import sessionRoutes from './routes/session';
import uploadRoutes from './routes/upload';
import partnerRoutes from './routes/partner';
import penaltyRoutes from './routes/penalty';
import dashboardRoutes from './routes/dashboard';

const app = express();
const PORT = process.env.PORT || 3001;
const isProd = process.env.NODE_ENV === 'production';

// CORS - allow the Vite dev server to talk to us
app.use(cors({
  origin: isProd
    ? process.env.ALLOWED_ORIGIN || 'http://localhost:5173'
    : ['http://localhost:5173', 'http://localhost:3000', 'http://127.0.0.1:5173'],
  credentials: true,
}));

// 10MB limit — enough for image uploads while preventing large payload DoS
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
// cookie-parser required by csrf-csrf to read/write CSRF cookies
app.use(cookieParser());

// Session middleware - cookie is httpOnly + sameSite for security
app.use(session({
  secret: process.env.SESSION_SECRET || 'fivemoremins-dev-secret-please-change',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: isProd,        // HTTPS only in production
    httpOnly: true,        // Not accessible via JS
    sameSite: 'strict',    // Blocks cross-site requests
    maxAge: 7 * 24 * 60 * 60 * 1000, // 1 week
  },
}));

// CSRF protection using double-submit cookie pattern
const { generateCsrfToken, doubleCsrfProtection } = doubleCsrf({
  getSecret: () => process.env.SESSION_SECRET || 'fivemoremins-csrf-secret',
  // Use auth token as session identifier so each user gets a distinct CSRF token
  getSessionIdentifier: (req) =>
    (req.headers.authorization?.replace('Bearer ', '') || req.headers['x-auth-token'] as string || 'anonymous'),
  cookieName: 'fmm.x-csrf-token',
  cookieOptions: {
    secure: isProd,
    sameSite: 'strict',
    httpOnly: true,
  },
  size: 64,
  getCsrfTokenFromRequest: (req) =>
    (req.headers['x-csrf-token'] as string) || (req.body as Record<string, string>)?.['_csrf'],
});

// Rate limiters — generic API limiter for all routes
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, slow down.' },
});

// Stricter limit for auth endpoints (prevent brute force / account enumeration)
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many auth attempts. Try again later.' },
});

// Very strict limit on penalty trigger to prevent partner email spam
const penaltyLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour window
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Penalty rate limit hit. Go do some work.' },
});

// Serve uploaded images statically (read-only, no rate limiting needed here)
app.use('/uploads', express.static(path.join(__dirname, '..', 'uploads')));

// Endpoint to get a CSRF token — frontend calls this on app load
app.get('/api/csrf-token', (req, res) => {
  const token = generateCsrfToken(req, res);
  res.json({ csrfToken: token });
});

// Apply rate limiting globally to all /api routes
app.use('/api', apiLimiter);

// Mount routes (CSRF protection is applied per-route group on state-changing routes)
app.use('/api/auth', authLimiter, doubleCsrfProtection, authRoutes);
app.use('/api/session', doubleCsrfProtection, sessionRoutes);
app.use('/api/upload', doubleCsrfProtection, uploadRoutes);
app.use('/api/partner', doubleCsrfProtection, partnerRoutes);
app.use('/api/penalty', penaltyLimiter, doubleCsrfProtection, penaltyRoutes);
app.use('/api/dashboard', dashboardRoutes); // read-only, no CSRF needed

// Health check
app.get('/api/health', (_req, res) => {
  res.json({ status: 'alive', message: 'FiveMoreMins backend is running ⚡' });
});

app.listen(PORT, () => {
  console.log(`\n🔥 FiveMoreMins backend running on http://localhost:${PORT}`);
  console.log(`   Upload dir: ${path.join(__dirname, '..', 'uploads')}`);
  console.log(`   Environment: ${process.env.NODE_ENV || 'development'}\n`);
});

export default app;
