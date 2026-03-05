import { Router, Request, Response } from 'express';
import db from '../db/connection';
import { generateToken } from '../utils/token';
import { sendPartnerInvite } from '../services/email';
import { requireAuth } from '../middleware/auth';
import { generalRateLimit } from '../middleware/rateLimit';

const router = Router();

interface PartnerConsentRow {
  id: number;
  user_id: number;
  partner_email: string;
  invite_token: string;
  invited_at: number;
  consented_at: number | null;
  consent_ip: string | null;
  consent_user_agent: string | null;
  revoked_at: number | null;
}

interface UserRow {
  id: number;
  email: string;
}

/**
 * POST /api/partner/invite
 * Send an opt-in invite to a partner email. Re-sending resets any previous consent.
 */
router.post('/invite', requireAuth, generalRateLimit, async (req: Request, res: Response) => {
  try {
    const userId = req.session.userId!;
    const { partner_email: partnerEmail } = req.body as { partner_email?: string };

    if (!partnerEmail || !partnerEmail.includes('@')) {
      res.status(400).json({ error: 'A valid partner email is required.' });
      return;
    }

    const normalizedEmail = partnerEmail.toLowerCase().trim();
    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(userId) as UserRow;
    const token = generateToken();

    // Check if a record already exists for this user+partner pair
    const existing = db
      .prepare('SELECT * FROM partner_consents WHERE user_id = ? AND partner_email = ?')
      .get(userId, normalizedEmail) as PartnerConsentRow | undefined;

    if (existing) {
      // Re-invite: reset consent state and issue a fresh token
      db.prepare(
        `UPDATE partner_consents
         SET invite_token = ?, consented_at = NULL, revoked_at = NULL,
             invited_at = strftime('%s', 'now')
         WHERE id = ?`,
      ).run(token, existing.id);
    } else {
      db.prepare(
        `INSERT INTO partner_consents (user_id, partner_email, invite_token)
         VALUES (?, ?, ?)`,
      ).run(userId, normalizedEmail, token);
    }

    await sendPartnerInvite(normalizedEmail, user.email, token);

    // Return the new partner status so the client can update its state
    res.json({
      partner_email: normalizedEmail,
      consented_at: null,
      revoked_at: null,
      invite_token: token,
    });
  } catch (err) {
    console.error('[partner] Invite error:', err);
    res.status(500).json({ error: 'Failed to send invite.' });
  }
});

/**
 * GET /api/partner/confirm/:token
 * The link in the partner invite email lands here.
 * Records consent and returns an HTML confirmation page.
 */
router.get('/confirm/:token', generalRateLimit, (req: Request, res: Response) => {
  try {
    const { token } = req.params;

    const consent = db
      .prepare('SELECT * FROM partner_consents WHERE invite_token = ?')
      .get(token) as PartnerConsentRow | undefined;

    if (!consent) {
      res.status(404).send(
        '<h1 style="font-family:sans-serif;text-align:center;margin-top:80px">Invalid or expired invite link.</h1>',
      );
      return;
    }

    if (consent.consented_at) {
      res.send(
        '<h1 style="font-family:sans-serif;text-align:center;margin-top:80px">You already confirmed this. You\'re already on the hook. 🎣</h1>',
      );
      return;
    }

    const ip = req.ip || req.socket.remoteAddress || '';
    const userAgent = req.headers['user-agent'] || '';
    const now = Math.floor(Date.now() / 1000);

    db.prepare(
      `UPDATE partner_consents
       SET consented_at = ?, consent_ip = ?, consent_user_agent = ?
       WHERE id = ?`,
    ).run(now, ip, userAgent, consent.id);

    const inviter = db
      .prepare('SELECT email FROM users WHERE id = ?')
      .get(consent.user_id) as UserRow | undefined;

    const userName = inviter?.email ?? 'your friend';

    res.send(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>You're In</title>
  <style>
    body { font-family: system-ui, sans-serif; background: #0f172a; color: #e2e8f0;
           display: flex; align-items: center; justify-content: center;
           min-height: 100vh; margin: 0; }
    .card { background: #1e293b; border-radius: 12px; padding: 48px;
            max-width: 480px; text-align: center; }
    h1 { color: #22c55e; font-size: 1.8rem; margin-bottom: 16px; }
    p { color: #94a3b8; line-height: 1.6; }
    strong { color: #e2e8f0; }
  </style>
</head>
<body>
  <div class="card">
    <h1>🎯 You're officially a digital bounty hunter.</h1>
    <p>You've agreed to receive accountability notifications from <strong>${userName}</strong>.</p>
    <p>If they fail their focus session, you'll know about it. No pressure.</p>
    <p style="margin-top:24px;font-size:0.85rem;color:#64748b">
      You can ask them to revoke this at any time.
    </p>
  </div>
</body>
</html>`);
  } catch (err) {
    console.error('[partner] Confirm error:', err);
    res.status(500).send('<h1 style="font-family:sans-serif;text-align:center">Something went wrong.</h1>');
  }
});

/**
 * GET /api/partner/status
 * Return the current partner consent record for the logged-in user.
 */
router.get('/status', requireAuth, generalRateLimit, (req: Request, res: Response) => {
  try {
    const userId = req.session.userId!;

    const partner = db
      .prepare(
        `SELECT partner_email, consented_at, revoked_at, invite_token
         FROM partner_consents
         WHERE user_id = ?
         ORDER BY invited_at DESC LIMIT 1`,
      )
      .get(userId) as Partial<PartnerConsentRow> | undefined;

    if (!partner) {
      // No partner record; return empty PartnerStatus (all optional fields absent)
      res.json({});
      return;
    }

    // Return a flat PartnerStatus object
    res.json({
      partner_email: partner.partner_email,
      consented_at: partner.consented_at ?? undefined,
      revoked_at: partner.revoked_at ?? undefined,
      invite_token: partner.invite_token,
    });
  } catch (err) {
    console.error('[partner] Status error:', err);
    res.status(500).json({ error: 'Failed to get partner status.' });
  }
});

/**
 * POST /api/partner/revoke
 * Revoke the active partner consent. They won't receive further emails.
 */
router.post('/revoke', requireAuth, generalRateLimit, (req: Request, res: Response) => {
  try {
    const userId = req.session.userId!;

    db.prepare(
      `UPDATE partner_consents
       SET revoked_at = strftime('%s', 'now')
       WHERE user_id = ? AND revoked_at IS NULL`,
    ).run(userId);

    res.json({ message: 'Partner consent revoked. You are on your own now.' });
  } catch (err) {
    console.error('[partner] Revoke error:', err);
    res.status(500).json({ error: 'Failed to revoke consent.' });
  }
});

export default router;
