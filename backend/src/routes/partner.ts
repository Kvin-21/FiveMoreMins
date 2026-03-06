import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { requireAuth } from '../middleware';
import db from '../db';
import { sendPenaltyEmail } from '../email';

const router = Router();

type AuthRequest = Request & { user: { id: number; email: string; partner_email: string; image_path: string } };

// POST /api/partner/invite - send an invite/consent email to the partner
router.post('/invite', requireAuth, async (req: Request, res: Response) => {
  const user = (req as AuthRequest).user;
  const { partnerEmail } = req.body;

  const targetEmail = partnerEmail || user.partner_email;

  if (!targetEmail) {
    return res.status(400).json({ error: 'Partner email is required' });
  }

  // Update user's partner email if provided
  if (partnerEmail) {
    db.prepare('UPDATE users SET partner_email = ? WHERE id = ?').run(partnerEmail, user.id);
  }

  const token = uuidv4();
  
  // Upsert the consent record
  const existing = db.prepare('SELECT * FROM partner_consents WHERE user_id = ? AND partner_email = ?').get(user.id, targetEmail);
  
  if (existing) {
    db.prepare('UPDATE partner_consents SET consent_token = ?, consented_at = NULL, revoked_at = NULL WHERE user_id = ? AND partner_email = ?')
      .run(token, user.id, targetEmail);
  } else {
    db.prepare('INSERT INTO partner_consents (user_id, partner_email, consent_token) VALUES (?, ?, ?)')
      .run(user.id, targetEmail, token);
  }

  // Send invite email (this is optional/nice-to-have in MVP)
  try {
    await sendPenaltyEmail({
      toEmail: targetEmail,
      fromEmail: user.email,
      awayMinutes: 0,
    });
  } catch (err) {
    console.error('Failed to send invite email:', err);
    // Don't fail the whole request, email is optional
  }

  return res.json({ success: true, token });
});

// GET /api/partner/confirm/:token - partner clicks link to give consent
router.get('/confirm/:token', (req: Request, res: Response) => {
  const { token } = req.params;

  const consent = db.prepare('SELECT * FROM partner_consents WHERE consent_token = ?').get(token) as { id: number } | undefined;

  if (!consent) {
    return res.status(404).send('<h1>Invalid or expired link</h1>');
  }

  db.prepare('UPDATE partner_consents SET consented_at = CURRENT_TIMESTAMP WHERE consent_token = ?').run(token);

  return res.send(`
    <html>
      <head><title>FiveMoreMins - Consent Confirmed</title></head>
      <body style="background:#0a0a0a;color:#00ff88;font-family:monospace;padding:40px;text-align:center;">
        <h1>✅ Consent Confirmed</h1>
        <p style="color:#ffffff;">You've agreed to receive blackmail notifications. Your friend will think twice before slacking now.</p>
      </body>
    </html>
  `);
});

export default router;
