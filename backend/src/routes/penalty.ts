import { Router, Request, Response } from 'express';
import path from 'path';
import { requireAuth } from '../middleware';
import db from '../db';
import { sendPenaltyEmail } from '../email';

const router = Router();

type AuthRequest = Request & { user: { id: number; email: string; partner_email: string; image_path: string } };

// Track penalty counts to enforce rate limit (in-memory is fine for MVP)
const penaltyCounts = new Map<number, { count: number; date: string }>();

// POST /api/penalty/trigger - THE MONEY SHOT. Send the blackmail email.
router.post('/trigger', requireAuth, async (req: Request, res: Response) => {
  const user = (req as AuthRequest).user;
  const { sessionId, awayMinutes } = req.body;

  if (!user.partner_email) {
    return res.status(400).json({ error: 'No accountability partner set' });
  }

  // Rate limit: max 3 penalties per day per user (so they can't spam their partner)
  const today = new Date().toISOString().split('T')[0];
  const userPenalties = penaltyCounts.get(user.id);
  
  if (userPenalties && userPenalties.date === today && userPenalties.count >= 3) {
    return res.status(429).json({ error: 'Max 3 penalties per day. Go do some work.' });
  }

  // Update penalty count
  if (!userPenalties || userPenalties.date !== today) {
    penaltyCounts.set(user.id, { count: 1, date: today });
  } else {
    penaltyCounts.set(user.id, { count: userPenalties.count + 1, date: today });
  }

  // Mark session as having triggered a penalty
  if (sessionId) {
    db.prepare('UPDATE sessions SET penalty_triggered = 1, status = ? WHERE id = ? AND user_id = ?')
      .run('failed', sessionId, user.id);
    
    // Reset the streak since they failed
    db.prepare('UPDATE streaks SET current_streak = 0 WHERE user_id = ?').run(user.id);
  }

  // Figure out image path if user has one
  let imagePath: string | undefined;
  if (user.image_path) {
    imagePath = path.join(__dirname, '..', '..', 'uploads', user.image_path);
  }

  try {
    await sendPenaltyEmail({
      toEmail: user.partner_email,
      fromEmail: user.email,
      awayMinutes: awayMinutes || 30,
      imagePath,
    });

    return res.json({ success: true, message: 'Penalty email sent. You played yourself.' });
  } catch (err) {
    console.error('Failed to send penalty email:', err);
    return res.status(500).json({ error: 'Failed to send email. But you still failed. Get back to work.' });
  }
});

export default router;
