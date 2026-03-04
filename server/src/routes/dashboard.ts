import { Router, Request, Response } from 'express';
import db from '../db/connection';
import { requireAuth } from '../middleware/auth';

const router = Router();

interface StreakRow {
  current_streak: number;
  longest_streak: number;
  last_session_date: string | null;
}

interface SessionRow {
  started_at: number;
  ended_at: number | null;
  outcome: string;
  away_seconds: number;
}

interface CountRow {
  count: number;
}

/**
 * GET /api/dashboard
 * Single endpoint that gives the frontend everything it needs for the dashboard.
 */
router.get('/', requireAuth, (req: Request, res: Response) => {
  try {
    const userId = req.session.userId!;

    // Current streak info
    const streak = db
      .prepare(
        `SELECT current_streak, longest_streak, last_session_date
         FROM streaks WHERE user_id = ?`,
      )
      .get(userId) as StreakRow | undefined;

    // Sessions from the last 7 days (excluding still-active ones)
    const sevenDaysAgo = Math.floor(Date.now() / 1000) - 7 * 24 * 60 * 60;
    const recentSessions = db
      .prepare(
        `SELECT started_at, outcome
         FROM sessions
         WHERE user_id = ? AND started_at > ? AND outcome != 'active'
         ORDER BY started_at DESC`,
      )
      .all(userId, sevenDaysAgo) as SessionRow[];

    // Last 5 failed sessions — the hall of shame
    const recentFailures = db
      .prepare(
        `SELECT started_at, ended_at, away_seconds
         FROM sessions
         WHERE user_id = ? AND outcome = 'failed'
         ORDER BY started_at DESC LIMIT 5`,
      )
      .all(userId) as SessionRow[];

    // All-time session count (excluding active)
    const { count: totalSessions } = db
      .prepare(
        `SELECT COUNT(*) as count FROM sessions
         WHERE user_id = ? AND outcome != 'active'`,
      )
      .get(userId) as CountRow;

    res.json({
      streak: streak ?? { current_streak: 0, longest_streak: 0, last_session_date: null },
      recentSessions,
      recentFailures,
      totalSessions,
    });
  } catch (err) {
    console.error('[dashboard] Error:', err);
    res.status(500).json({ error: 'Failed to load dashboard data.' });
  }
});

export default router;
