import express from 'express';
import cors from 'cors';
import session from 'express-session';
import path from 'path';
import fs from 'fs';
import { doubleCsrf } from 'csrf-csrf';

import { config } from './utils/config';
import { runMigrations } from './db/migrate';
import authRoutes from './routes/auth';
import sessionRoutes from './routes/session';
import uploadRoutes from './routes/upload';
import partnerRoutes from './routes/partner';
import penaltyRoutes from './routes/penalty';
import dashboardRoutes from './routes/dashboard';

const app = express();

// Allow the React dev server (or production domain) to talk to us with cookies
app.use(
  cors({
    origin: config.clientUrl,
    credentials: true,
  }),
);

app.use(express.json());

app.use(
  session({
    secret: config.sessionSecret,
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      sameSite: 'lax',
      // Require HTTPS in production; allow HTTP in dev so local testing works
      secure: process.env.NODE_ENV === 'production',
      maxAge: config.sessionCookieMaxAge,
    },
  }),
);

// CSRF protection via double-submit cookie pattern
const { generateCsrfToken, doubleCsrfProtection } = doubleCsrf({
  getSecret: () => config.sessionSecret,
  // Use session ID as identifier, fall back to IP if no session yet
  getSessionIdentifier: (req) => (req.session?.id ?? req.ip ?? 'anon'),
  cookieName: '_csrf',
  cookieOptions: {
    sameSite: 'lax',
    path: '/',
    secure: process.env.NODE_ENV === 'production',
    httpOnly: false, // must be readable by JS to send back as header
  },
  size: 64,
  ignoredMethods: ['GET', 'HEAD', 'OPTIONS'],
});

// Expose CSRF token for the SPA to fetch before any mutating request
app.get('/api/csrf-token', (req, res) => {
  res.json({ token: generateCsrfToken(req, res) });
});

// Serve uploaded images publicly — the client needs to display them
app.use('/uploads', express.static(path.resolve(process.cwd(), 'uploads')));

// Routes
app.use('/api', doubleCsrfProtection, authRoutes);          // signup, login/verify, me, logout
app.use('/api/session', doubleCsrfProtection, sessionRoutes);
app.use('/api', doubleCsrfProtection, uploadRoutes);        // upload-image
app.use('/api/partner', doubleCsrfProtection, partnerRoutes);
app.use('/api/penalty', doubleCsrfProtection, penaltyRoutes);
app.use('/api/dashboard', doubleCsrfProtection, dashboardRoutes);

// Quick health check — useful for Docker / load balancer probes
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Make sure the uploads directory exists at startup
const uploadsDir = path.resolve(process.cwd(), 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Run SQL migrations, then start listening
runMigrations();

app.listen(config.port, () => {
  console.log(`🚀 FiveMoreMins server running on port ${config.port}`);
  console.log(`📡 Accepting requests from ${config.clientUrl}`);
});

