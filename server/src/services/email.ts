import nodemailer from 'nodemailer';
import fs from 'fs';
import path from 'path';
import { config } from '../utils/config';

const transporter = nodemailer.createTransport({
  host: config.smtp.host,
  port: config.smtp.port,
  auth: {
    user: config.smtp.user,
    pass: config.smtp.pass,
  },
});

// Cache templates in memory after the first read — no need to hit the disk
// on every email send.
const templateCache = new Map<string, string>();

/**
 * Load an HTML template from src/templates/.
 * Works whether running via ts-node-dev (CWD = server/) or compiled JS.
 */
function loadTemplate(filename: string): string {
  const cached = templateCache.get(filename);
  if (cached) return cached;

  const templatePath = path.resolve(process.cwd(), 'src', 'templates', filename);
  const content = fs.readFileSync(templatePath, 'utf-8');
  templateCache.set(filename, content);
  return content;
}

/** Simple mustache-style replacement: {{key}} → value */
function render(template: string, vars: Record<string, string>): string {
  return Object.entries(vars).reduce((html, [key, value]) => {
    return html.split(`{{${key}}}`).join(value);
  }, template);
}

/** Send a magic login link to the user. Best-effort — logs errors, doesn't throw. */
export async function sendMagicLink(email: string, token: string): Promise<void> {
  try {
    const loginUrl = `${config.clientUrl}/auth/verify?token=${token}`;
    const html = render(loadTemplate('magicLink.html'), { loginUrl, email });

    await transporter.sendMail({
      from: config.fromEmail,
      to: email,
      subject: "Your login link. Click it. Or don't. See if we care.",
      html,
    });
  } catch (err) {
    console.error('[email] Failed to send magic link:', err);
  }
}

/** Invite a partner to opt in to accountability notifications. */
export async function sendPartnerInvite(
  partnerEmail: string,
  userName: string,
  token: string,
): Promise<void> {
  try {
    const confirmUrl = `${config.serverUrl}/api/partner/confirm/${token}`;
    const html = render(loadTemplate('partnerInvite.html'), { userName, confirmUrl });

    await transporter.sendMail({
      from: config.fromEmail,
      to: partnerEmail,
      subject: `${userName} has chosen you as their accountability partner. Bold move.`,
      html,
    });
  } catch (err) {
    console.error('[email] Failed to send partner invite:', err);
  }
}

/** Tell the partner their friend blew it. Attach the shame image. */
export async function sendPenaltyToPartner(
  partnerEmail: string,
  userName: string,
  imagePath: string,
): Promise<void> {
  try {
    const sessionSummary = `${userName} started a focus session and didn't finish it.`;
    const html = render(loadTemplate('penaltyPartner.html'), { userName, sessionSummary });

    const attachments =
      imagePath && fs.existsSync(imagePath)
        ? [{ filename: path.basename(imagePath), path: imagePath }]
        : [];

    await transporter.sendMail({
      from: config.fromEmail,
      to: partnerEmail,
      subject: `🚨 ${userName} failed their focus session`,
      html,
      attachments,
    });
  } catch (err) {
    console.error('[email] Failed to send partner penalty email:', err);
  }
}

/** No partner? The shame comes home. Send the summary to the user themselves. */
export async function sendPenaltyToSelf(email: string, sessionSummary: string): Promise<void> {
  try {
    const html = render(loadTemplate('penaltySelf.html'), { sessionSummary });

    await transporter.sendMail({
      from: config.fromEmail,
      to: email,
      subject: 'You failed your focus session. Here is your receipt.',
      html,
    });
  } catch (err) {
    console.error('[email] Failed to send self-penalty email:', err);
  }
}
