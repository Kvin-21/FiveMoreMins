import db from '../db/connection';
import { sendPenaltyToPartner, sendPenaltyToSelf } from './email';
import { getImagePath } from './storage';

interface SessionRow {
  id: number;
  user_id: number;
  outcome: string;
  penalty_triggered: number;
}

interface PartnerConsentRow {
  id: number;
  partner_email: string;
  consented_at: number | null;
  revoked_at: number | null;
}

interface UserRow {
  id: number;
  email: string;
}

interface ImageRow {
  id: number;
  user_id: number;
}

interface CountRow {
  count: number;
}

/**
 * Trigger the penalty flow for a session.
 * Sends an email to the accountability partner (with the user's latest image
 * attached) if one exists and is consented. Falls back to a self-shame email
 * if there's no active partner or if the per-day rate limit is hit.
 */
export async function triggerPenalty(sessionId: number, userId: number): Promise<void> {
  const session = db
    .prepare('SELECT * FROM sessions WHERE id = ? AND user_id = ?')
    .get(sessionId, userId) as SessionRow | undefined;

  if (!session) {
    throw new Error('Session not found');
  }

  if (session.penalty_triggered) {
    throw new Error('Penalty already triggered for this session');
  }

  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(userId) as UserRow;

  // Check for an active (consented, not revoked) partner
  const partner = db
    .prepare(
      `SELECT * FROM partner_consents
       WHERE user_id = ? AND consented_at IS NOT NULL AND revoked_at IS NULL
       ORDER BY consented_at DESC LIMIT 1`,
    )
    .get(userId) as PartnerConsentRow | undefined;

  if (partner) {
    // Cap at 3 penalty emails per partner per calendar day — don't harass people
    // Use UTC midnight to avoid timezone-dependent rate-limit windows
    const now = new Date();
    const todayStart = Math.floor(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()) / 1000,
    );
    const todayEnd = todayStart + 86400;

    const { count } = db
      .prepare(
        `SELECT COUNT(*) as count FROM penalty_log
         WHERE user_id = ? AND recipient = ? AND sent_at BETWEEN ? AND ?`,
      )
      .get(userId, partner.partner_email, todayStart, todayEnd) as CountRow;

    if (count >= 3) {
      // Rate limit hit — redirect shame inward
      await sendPenaltyToSelf(
        user.email,
        `Session #${sessionId} — partner daily limit reached, shame redirected to you.`,
      );
      logPenalty(sessionId, userId, 'self_email', user.email, 'partner_rate_limited');
    } else {
      // Grab the most recent uploaded image to attach
      const image = db
        .prepare(
          `SELECT * FROM images
           WHERE user_id = ? AND deleted_at IS NULL
           ORDER BY uploaded_at DESC LIMIT 1`,
        )
        .get(userId) as ImageRow | undefined;

      const imagePath = image ? (getImagePath(image.id) ?? '') : '';

      await sendPenaltyToPartner(partner.partner_email, user.email, imagePath);
      logPenalty(sessionId, userId, 'partner_email', partner.partner_email);
    }
  } else {
    // No partner — you reap what you sow
    await sendPenaltyToSelf(
      user.email,
      `Session #${sessionId} — you had no accountability partner, so here's your self-roast.`,
    );
    logPenalty(sessionId, userId, 'self_email', user.email, 'no_partner');
  }

  // Mark the session so we can't fire this twice
  db.prepare('UPDATE sessions SET penalty_triggered = 1 WHERE id = ?').run(sessionId);
}

function logPenalty(
  sessionId: number,
  userId: number,
  type: 'partner_email' | 'self_email' | 'social_post',
  recipient: string,
  metadata?: string,
): void {
  db.prepare(
    `INSERT INTO penalty_log (session_id, user_id, type, recipient, metadata)
     VALUES (?, ?, ?, ?, ?)`,
  ).run(sessionId, userId, type, recipient, metadata ?? null);
}
