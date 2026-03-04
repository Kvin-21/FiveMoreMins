import express from 'express';
import cors from 'cors';
import session from 'express-session';
import path from 'path';
import fs from 'fs';

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
      maxAge: 7 * 24 * 60 * 60 * 1000, // stay logged in for a week
    },
  }),
);

// Serve uploaded images publicly — the client needs to display them
app.use('/uploads', express.static(path.resolve(process.cwd(), 'uploads')));

// Routes
app.use('/api', authRoutes);          // signup, login/verify, me, logout
app.use('/api/session', sessionRoutes);
app.use('/api', uploadRoutes);        // upload-image
app.use('/api/partner', partnerRoutes);
app.use('/api/penalty', penaltyRoutes);
app.use('/api/dashboard', dashboardRoutes);

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
