import { Router, Request, Response } from 'express';
import db from '../db/connection';
import { requireAuth } from '../middleware/auth';
import { generalRateLimit } from '../middleware/rateLimit';

const router = Router();

interface SessionRow {
  id: number;
  user_id: number;
  started_at: number;
  ended_at: number | null;
  focus_duration: number | null;
  outcome: string;
  away_seconds: number;
}

interface StreakRow {
  id: number;
  user_id: number;
  current_streak: number;
  longest_streak: number;
  last_session_date: string | null;
}

/**
 * POST /api/session/start
 * Create a new 'active' session. Returns the new session id.
 */
router.post('/start', requireAuth, generalRateLimit, (req: Request, res: Response) => {
  try {
    const userId = req.session.userId!;
    const { focusDuration } = req.body as { focusDuration?: number };

    const result = db
      .prepare(
        `INSERT INTO sessions (user_id, focus_duration, outcome)
         VALUES (?, ?, 'active')`,
      )
      .run(userId, focusDuration ?? null);

    res.json({ session: { id: result.lastInsertRowid } });
  } catch (err) {
    console.error('[session] Start error:', err);
    res.status(500).json({ error: 'Failed to start session.' });
  }
});

/**
 * POST /api/session/end
 * Mark a session as ended with an outcome. Updates streak if completed.
 */
router.post('/end', requireAuth, generalRateLimit, (req: Request, res: Response) => {
  try {
    const userId = req.session.userId!;
    const { session_id: sessionId, outcome, away_seconds: awaySeconds, focus_duration: focusDuration } = req.body as {
      session_id: number;
      outcome: 'completed' | 'failed' | 'abandoned';
      away_seconds?: number;
      focus_duration?: number;
    };

    if (!sessionId || !outcome) {
      res.status(400).json({ error: 'session_id and outcome are required.' });
      return;
    }

    const session = db
      .prepare('SELECT * FROM sessions WHERE id = ? AND user_id = ?')
      .get(sessionId, userId) as SessionRow | undefined;

    if (!session) {
      res.status(404).json({ error: 'Session not found.' });
      return;
    }

    const now = Math.floor(Date.now() / 1000);
    db.prepare(
      `UPDATE sessions SET ended_at = ?, outcome = ?, away_seconds = ?, focus_duration = COALESCE(?, focus_duration) WHERE id = ?`,
    ).run(now, outcome, awaySeconds ?? 0, focusDuration ?? null, sessionId);

    if (outcome === 'completed') {
      updateStreak(userId);
    }

    res.json({ message: 'Session ended.', outcome });
  } catch (err) {
    console.error('[session] End error:', err);
    res.status(500).json({ error: 'Failed to end session.' });
  }
});

/**
 * Update the streak for a user after a completed session.
 * Yesterday → extend. Today → idempotent. Anything else → reset to 1.
 */
function updateStreak(userId: number): void {
  const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD

  const existing = db
    .prepare('SELECT * FROM streaks WHERE user_id = ?')
    .get(userId) as StreakRow | undefined;

  if (!existing) {
    db.prepare(
      `INSERT INTO streaks (user_id, current_streak, longest_streak, last_session_date)
       VALUES (?, 1, 1, ?)`,
    ).run(userId, today);
    return;
  }

  const last = existing.last_session_date;

  if (last === today) {
    // Already have a completed session today — streak is fine, move on
    return;
  }

  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayStr = yesterday.toISOString().split('T')[0];

  const newStreak = last === yesterdayStr ? existing.current_streak + 1 : 1;
  const newLongest = Math.max(newStreak, existing.longest_streak);

  db.prepare(
    `UPDATE streaks
     SET current_streak = ?, longest_streak = ?, last_session_date = ?,
         updated_at = strftime('%s', 'now')
     WHERE user_id = ?`,
  ).run(newStreak, newLongest, today, userId);
}

export default router;
