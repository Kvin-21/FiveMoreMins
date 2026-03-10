import { Router, Request, Response } from 'express';
import { requireAuth } from '../middleware';
import db from '../db';

const router = Router();

type AuthRequest = Request & { user: { id: number; email: string; partner_email: string; image_path: string } };

// POST /api/session/start - kick off a new focus session
router.post('/start', requireAuth, (req: Request, res: Response) => {
  const user = (req as AuthRequest).user;

  // End any active sessions first (shouldn't normally happen but just in case)
  db.prepare(`
    UPDATE sessions 
    SET status = 'abandoned', ended_at = CURRENT_TIMESTAMP
    WHERE user_id = ? AND status = 'active'
  `).run(user.id);

  const result = db.prepare(`
    INSERT INTO sessions (user_id, status) VALUES (?, 'active')
  `).run(user.id);

  const session = db.prepare('SELECT * FROM sessions WHERE id = ?').get(result.lastInsertRowid);

  return res.json({ session });
});

// POST /api/session/end - wrap up a session
router.post('/end', requireAuth, (req: Request, res: Response) => {
  const user = (req as AuthRequest).user;
  const { sessionId, status, longestAway, duration, breakSeconds } = req.body;

  if (!sessionId) {
    return res.status(400).json({ error: 'sessionId is required' });
  }

  // Make sure this session belongs to the current user
  const session = db.prepare('SELECT * FROM sessions WHERE id = ? AND user_id = ?').get(sessionId, user.id) as { id: number; status: string } | undefined;

  if (!session) {
    return res.status(404).json({ error: 'Session not found' });
  }

  db.prepare(`
    UPDATE sessions 
    SET status = ?, ended_at = CURRENT_TIMESTAMP, duration_seconds = ?, longest_away_seconds = ?, break_seconds = ?
    WHERE id = ?
  `).run(status || 'completed', duration || 0, longestAway || 0, breakSeconds || 0, sessionId);

  // Update streaks if session completed successfully
  if (status === 'completed') {
    updateStreak(user.id);
  } else if (status === 'failed') {
    resetStreak(user.id);
  }

  return res.json({ success: true });
});

// GET /api/session/active - check if there's an active session
router.get('/active', requireAuth, (req: Request, res: Response) => {
  const user = (req as AuthRequest).user;

  const session = db.prepare(`
    SELECT * FROM sessions WHERE user_id = ? AND status = 'active' ORDER BY started_at DESC LIMIT 1
  `).get(user.id);

  return res.json({ session: session || null });
});

function updateStreak(userId: number) {
  const streak = db.prepare('SELECT * FROM streaks WHERE user_id = ?').get(userId) as { id: number; current_streak: number; longest_streak: number; last_session_date: string } | undefined;
  const today = new Date().toISOString().split('T')[0];

  if (!streak) {
    db.prepare('INSERT INTO streaks (user_id, current_streak, longest_streak, last_session_date) VALUES (?, 1, 1, ?)').run(userId, today);
    return;
  }

  const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];

  if (streak.last_session_date === today) {
    // Already logged today, just update longest if needed
    if (streak.current_streak > streak.longest_streak) {
      db.prepare('UPDATE streaks SET longest_streak = ? WHERE user_id = ?').run(streak.current_streak, userId);
    }
    return;
  }

  if (streak.last_session_date === yesterday) {
    // Continuing a streak
    const newStreak = streak.current_streak + 1;
    const newLongest = Math.max(newStreak, streak.longest_streak);
    db.prepare('UPDATE streaks SET current_streak = ?, longest_streak = ?, last_session_date = ? WHERE user_id = ?')
      .run(newStreak, newLongest, today, userId);
  } else {
    // Streak broken, start fresh
    db.prepare('UPDATE streaks SET current_streak = 1, last_session_date = ? WHERE user_id = ?').run(today, userId);
    if (streak.longest_streak < 1) {
      db.prepare('UPDATE streaks SET longest_streak = 1 WHERE user_id = ?').run(userId);
    }
  }
}

function resetStreak(userId: number) {
  db.prepare('UPDATE streaks SET current_streak = 0 WHERE user_id = ?').run(userId);
}

export default router;