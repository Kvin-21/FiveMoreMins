import { Router, Request, Response } from 'express';
import db from '../db/connection';
import { config } from '../utils/config';
import { generateToken } from '../utils/token';
import { sendMagicLink } from '../services/email';
import { requireAuth } from '../middleware/auth';
import { authRateLimit, generalRateLimit } from '../middleware/rateLimit';

const router = Router();

interface UserRow {
  id: number;
  email: string;
  login_token: string | null;
  login_token_expires: number | null;
  created_at: number;
}

/**
 * POST /api/signup
 * Create or look up a user by email, issue a magic link token, send it.
 * We call it "signup" but it's really "auth" — same flow either way.
 */
router.post('/signup', authRateLimit, async (req: Request, res: Response) => {
  try {
    const { email } = req.body as { email?: string };

    if (!email || !email.includes('@')) {
      res.status(400).json({ error: 'A valid email address is required.' });
      return;
    }

    const normalizedEmail = email.toLowerCase().trim();
    const token = generateToken();
    const expires = Math.floor(Date.now() / 1000) + config.magicLinkTtl;

    db.prepare(
      `INSERT INTO users (email, login_token, login_token_expires)
       VALUES (?, ?, ?)
       ON CONFLICT(email) DO UPDATE SET
         login_token = excluded.login_token,
         login_token_expires = excluded.login_token_expires,
         updated_at = strftime('%s', 'now')`,
    ).run(normalizedEmail, token, expires);

    await sendMagicLink(normalizedEmail, token);

    res.json({ message: 'Magic link sent. Check your email (and maybe your spam folder).' });
  } catch (err) {
    console.error('[auth] Signup error:', err);
    res.status(500).json({ error: 'Something went wrong. Try again.' });
  }
});

/**
 * POST /api/login/verify
 * Validate the token from the magic link. Set the session. Return user data.
 */
router.post('/login/verify', authRateLimit, async (req: Request, res: Response) => {
  try {
    const { token } = req.body as { token?: string };

    if (!token) {
      res.status(400).json({ error: 'Token is required.' });
      return;
    }

    const now = Math.floor(Date.now() / 1000);
    const user = db
      .prepare(
        `SELECT * FROM users
         WHERE login_token = ? AND login_token_expires > ?`,
      )
      .get(token, now) as UserRow | undefined;

    if (!user) {
      res.status(401).json({ error: 'Invalid or expired token. Request a new link.' });
      return;
    }

    // Single-use: clear the token immediately after successful verification
    db.prepare(
      `UPDATE users
       SET login_token = NULL, login_token_expires = NULL, updated_at = strftime('%s', 'now')
       WHERE id = ?`,
    ).run(user.id);

    req.session.userId = user.id;

    res.json({ user: { id: user.id, email: user.email } });
  } catch (err) {
    console.error('[auth] Login verify error:', err);
    res.status(500).json({ error: 'Something went wrong. Try again.' });
  }
});

/**
 * GET /api/me
 * Return the currently authenticated user.
 */
router.get('/me', requireAuth, generalRateLimit, (req: Request, res: Response) => {
  const user = db
    .prepare('SELECT id, email, created_at FROM users WHERE id = ?')
    .get(req.session.userId) as UserRow | undefined;

  if (!user) {
    res.status(404).json({ error: 'User not found.' });
    return;
  }

  res.json({ user });
});

/**
 * POST /api/logout
 * Destroy the session and send the user back into the void.
 */
router.post('/logout', generalRateLimit, (req: Request, res: Response) => {
  req.session.destroy((err) => {
    if (err) console.error('[auth] Session destroy error:', err);
    res.json({ message: 'Logged out. See you on the other side.' });
  });
});

/**
 * DELETE /api/account
 * Permanently delete the authenticated user and all their data.
 */
router.delete('/account', requireAuth, generalRateLimit, (req: Request, res: Response) => {
  try {
    const userId = req.session.userId!;

    // CASCADE deletes handle sessions, images, partner_consents, streaks, penalty_log
    db.prepare('DELETE FROM users WHERE id = ?').run(userId);

    req.session.destroy((err) => {
      if (err) console.error('[auth] Session destroy on account delete:', err);
      res.status(204).end();
    });
  } catch (err) {
    console.error('[auth] Account delete error:', err);
    res.status(500).json({ error: 'Failed to delete account.' });
  }
});

export default router;
