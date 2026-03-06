import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import db from '../db';

const router = Router();

// POST /api/auth/signup - create a new account
router.post('/signup', (req: Request, res: Response) => {
  const { email, partnerEmail } = req.body;

  if (!email) {
    return res.status(400).json({ error: 'Email is required' });
  }

  // Check if already exists
  const existing = db.prepare('SELECT * FROM users WHERE email = ?').get(email) as { id: number } | undefined;
  if (existing) {
    // User exists, just return a new token (basically "login")
    const token = uuidv4();
    db.prepare('UPDATE users SET session_token = ?, partner_email = COALESCE(?, partner_email) WHERE email = ?')
      .run(token, partnerEmail || null, email);

    const user = db.prepare('SELECT id, email, partner_email, image_path FROM users WHERE email = ?').get(email) as { id: number; email: string; partner_email: string; image_path: string };
    return res.json({ token, user });
  }

  // Create new user
  const token = uuidv4();
  const result = db.prepare('INSERT INTO users (email, partner_email, session_token) VALUES (?, ?, ?)')
    .run(email, partnerEmail || null, token);

  // Create streak record
  db.prepare('INSERT INTO streaks (user_id) VALUES (?)').run(result.lastInsertRowid);

  const user = db.prepare('SELECT id, email, partner_email, image_path FROM users WHERE id = ?').get(result.lastInsertRowid) as { id: number; email: string; partner_email: string; image_path: string };

  return res.json({ token, user });
});

// POST /api/auth/login - login with just email (passwordless for MVP)
router.post('/login', (req: Request, res: Response) => {
  const { email } = req.body;

  if (!email) {
    return res.status(400).json({ error: 'Email is required' });
  }

  const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email) as { id: number; email: string; partner_email: string; image_path: string } | undefined;

  if (!user) {
    return res.status(404).json({ error: 'User not found. Sign up first!' });
  }

  const token = uuidv4();
  db.prepare('UPDATE users SET session_token = ? WHERE email = ?').run(token, email);

  return res.json({ token, user: { id: user.id, email: user.email, partner_email: user.partner_email, image_path: user.image_path } });
});

// GET /api/auth/me - get current user info
router.get('/me', (req: Request, res: Response) => {
  const token = req.headers.authorization?.replace('Bearer ', '') || req.headers['x-auth-token'] as string;

  if (!token) {
    return res.status(401).json({ error: 'No token' });
  }

  const user = db.prepare('SELECT id, email, partner_email, image_path FROM users WHERE session_token = ?').get(token) as { id: number; email: string; partner_email: string; image_path: string } | undefined;

  if (!user) {
    return res.status(401).json({ error: 'Invalid token' });
  }

  return res.json({ user });
});

export default router;
