import { Router, Request, Response } from 'express';
import { requireAuth } from '../middleware';
import db from '../db';

const router = Router();

type AuthRequest = Request & { user: { id: number; email: string; partner_email: string; image_path: string } };

// GET /api/dashboard - all the stats a procrastinator needs to feel shame
router.get('/', requireAuth, (req: Request, res: Response) => {
  const user = (req as AuthRequest).user;

  // Get streak info
  const streak = db.prepare('SELECT * FROM streaks WHERE user_id = ?').get(user.id) as {
    current_streak: number;
    longest_streak: number;
    last_session_date: string;
  } | undefined;

  // Get last 7 days of sessions
  const lastSevenDays = db.prepare(`
    SELECT 
      DATE(started_at) as date,
      COUNT(*) as total,
      SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as successes,
      SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failures
    FROM sessions
    WHERE user_id = ? AND started_at >= DATE('now', '-7 days')
    GROUP BY DATE(started_at)
    ORDER BY date DESC
  `).all(user.id) as { date: string; total: number; successes: number; failures: number }[];

  // Overall stats
  const totalStats = db.prepare(`
    SELECT 
      COUNT(*) as total_sessions,
      SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as total_successes,
      SUM(CASE WHEN status = 'failed' OR penalty_triggered = 1 THEN 1 ELSE 0 END) as total_failures,
      SUM(duration_seconds) as total_focus_time
    FROM sessions
    WHERE user_id = ?
  `).get(user.id) as { total_sessions: number; total_successes: number; total_failures: number; total_focus_time: number };

  // Recent failures with detail
  const recentFailures = db.prepare(`
    SELECT id, started_at, ended_at, duration_seconds, longest_away_seconds, penalty_triggered
    FROM sessions
    WHERE user_id = ? AND (status = 'failed' OR penalty_triggered = 1)
    ORDER BY started_at DESC
    LIMIT 10
  `).all(user.id) as { id: number; started_at: string; ended_at: string; duration_seconds: number; longest_away_seconds: number; penalty_triggered: number }[];

  // Full session history - every session ever, newest first
  const allSessions = db.prepare(`
    SELECT id, started_at, ended_at, duration_seconds, longest_away_seconds, penalty_triggered, status,
           COALESCE(break_seconds, 0) as break_seconds
    FROM sessions
    WHERE user_id = ?
    ORDER BY started_at DESC
  `).all(user.id) as { id: number; started_at: string; ended_at: string; duration_seconds: number; longest_away_seconds: number; penalty_triggered: number; status: string; break_seconds: number }[];

  const successRate = totalStats.total_sessions > 0
    ? Math.round((totalStats.total_successes / totalStats.total_sessions) * 100)
    : 0;

  return res.json({
    streak: {
      current: streak?.current_streak || 0,
      longest: streak?.longest_streak || 0,
      lastSessionDate: streak?.last_session_date || null,
    },
    lastSevenDays,
    stats: {
      totalSessions: totalStats.total_sessions || 0,
      totalSuccesses: totalStats.total_successes || 0,
      totalFailures: totalStats.total_failures || 0,
      totalFocusTime: totalStats.total_focus_time || 0,
      successRate,
    },
    recentFailures,
    allSessions,
  });
});

export default router;