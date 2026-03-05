import express from 'express';
import cors from 'cors';
import session from 'express-session';
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

const app = express();
const PORT = process.env.PORT || 3001;

// CORS - allow the Vite dev server to talk to us
app.use(cors({
  origin: ['http://localhost:5173', 'http://localhost:3000', 'http://127.0.0.1:5173'],
  credentials: true,
}));

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Session middleware (basic, for MVP)
app.use(session({
  secret: process.env.SESSION_SECRET || 'fivemoremins-dev-secret-please-change',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: false, // Set to true in production with HTTPS
    maxAge: 7 * 24 * 60 * 60 * 1000, // 1 week
  },
}));

// Serve uploaded images statically
app.use('/uploads', express.static(path.join(__dirname, '..', 'uploads')));

// Mount routes
app.use('/api/auth', authRoutes);
app.use('/api/session', sessionRoutes);
app.use('/api/upload', uploadRoutes);
app.use('/api/partner', partnerRoutes);
app.use('/api/penalty', penaltyRoutes);
app.use('/api/dashboard', dashboardRoutes);

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
