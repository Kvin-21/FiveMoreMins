import { Router, Request, Response } from 'express';
import db from '../db/connection';
import { triggerPenalty } from '../services/penalty';
import { requireAuth } from '../middleware/auth';

const router = Router();

interface SessionRow {
  id: number;
  user_id: number;
  outcome: string;
}

/**
 * POST /api/penalty/trigger
 * Called when the client detects a focus session failure.
 * Looks up the user's active session and fires the penalty service.
 */
router.post('/trigger', requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = req.session.userId!;

    const session = db
      .prepare(
        `SELECT * FROM sessions
         WHERE user_id = ? AND outcome = 'active'
         ORDER BY started_at DESC LIMIT 1`,
      )
      .get(userId) as SessionRow | undefined;

    if (!session) {
      res.status(404).json({ error: 'No active session found. Start one first.' });
      return;
    }

    await triggerPenalty(session.id, userId);

    res.json({ message: 'Penalty triggered. The shame has been dispatched.' });
  } catch (err) {
    console.error('[penalty] Trigger error:', err);
    if (err instanceof Error) {
      res.status(400).json({ error: err.message });
    } else {
      res.status(500).json({ error: 'Failed to trigger penalty.' });
    }
  }
});

export default router;
