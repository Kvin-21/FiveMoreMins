import express from 'express';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import path from 'path';
import dotenv from 'dotenv';

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
import trainRoutes from './routes/train';

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

// Apply rate limiting globally to all /api routes
app.use('/api', apiLimiter);

// Mount routes
app.use('/api/auth', authLimiter, authRoutes);
app.use('/api/session', sessionRoutes);
app.use('/api/upload', uploadRoutes);
app.use('/api/partner', partnerRoutes);
app.use('/api/penalty', penaltyLimiter, penaltyRoutes);
app.use('/api/dashboard', dashboardRoutes);

// Training endpoint - secret-ish, no auth needed since it's localhost only
app.use('/train', trainRoutes);

// Health check
app.get('/api/health', (_req, res) => {
  res.json({ status: 'alive', message: 'FiveMoreMins backend is running ⚡' });
});

app.listen(PORT, () => {
  console.log(`\n🔥 FiveMoreMins backend running on http://localhost:${PORT}`);
  console.log(`   Upload dir: ${path.join(__dirname, '..', 'uploads')}`);
  console.log(`   Train UI:   http://localhost:${PORT}/train`);
  console.log(`   Environment: ${process.env.NODE_ENV || 'development'}\n`);
});

export default app;