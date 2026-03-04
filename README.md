# FiveMoreMins 🔥

> The anti-procrastination app that fights dirty.

---

## How It Works

FiveMoreMins uses tab-switching detection to catch you in the act of procrastinating. Here's the escalation:

1. **Tab Detection** — The moment you switch away from the focus tab, we start a timer.
2. **Escalating Roasts** — Come back after 5 minutes? You get roasted (mildly). 15 minutes? Medium roast. 30 minutes? Full aggression mode.
3. **Blackmail Mode** — If you've uploaded an embarrassing image and connected an accountability partner, staying away for 30+ minutes will trigger an automated email to your partner with your photo. No mercy.

All image sharing requires **explicit opt-in** from your partner. No surprises for them (well, except for your photo).

---

## Screenshots

_Screenshots coming soon — app is in MVP stage._

---

## Getting Started

### Prerequisites
- Node.js 18+
- npm 9+

### Setup

1. **Clone the repo**
   ```bash
   git clone https://github.com/Kvin-21/FiveMoreMins
   cd FiveMoreMins
   ```

2. **Install all dependencies**
   ```bash
   npm run install:all
   ```

3. **Configure the server**
   ```bash
   cd server
   cp .env.example .env
   # Edit .env with your SMTP credentials
   ```

4. **Run dev servers**
   ```bash
   # From root directory (runs both client and server)
   npm run dev

   # Or individually:
   npm run dev:client   # Vite dev server → http://localhost:5173
   npm run dev:server   # Express API    → http://localhost:3001
   ```

5. **Open your browser**
   Navigate to `http://localhost:5173`

### SMTP Setup

The app uses Nodemailer. For local testing, you can use [Mailhog](https://github.com/mailhog/MailHog) or [Mailtrap](https://mailtrap.io). For production, SendGrid SMTP works out of the box with the provided config.

---

## API Reference

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/api/signup` | No | Send magic link email |
| POST | `/api/login/verify` | No | Verify token, create session |
| GET | `/api/me` | Yes | Get current user |
| POST | `/api/logout` | Yes | Clear session |
| POST | `/api/session/start` | Yes | Start a focus session |
| POST | `/api/session/end` | Yes | End session with outcome |
| POST | `/api/upload-image` | Yes | Upload accountability image |
| POST | `/api/partner/invite` | Yes | Invite accountability partner |
| GET | `/api/partner/confirm/:token` | No | Partner consent confirmation |
| GET | `/api/partner/status` | Yes | Get partner status |
| POST | `/api/partner/revoke` | Yes | Revoke partner consent |
| POST | `/api/penalty/trigger` | Yes | Trigger penalty (send email) |
| GET | `/api/dashboard` | Yes | Get streak and session stats |

---

## Tech Stack

| Layer | Choice |
|-------|--------|
| Frontend | React 18 + TypeScript + Vite |
| Backend | Node.js + Express + TypeScript |
| Database | SQLite via `better-sqlite3` (sync, simple for MVP) |
| Email | Nodemailer (SMTP config via env vars) |
| File storage | Local filesystem (`/uploads`) |
| Auth | Magic-link email login + session cookies |

---

## Database Schema

- **users** — Email accounts with magic-link tokens
- **images** — Uploaded accountability images (30-day auto-expiry)
- **partner_consents** — Partner opt-in records with IP/user-agent logging
- **sessions** — Focus session records (duration, outcome, away time)
- **penalty_log** — Audit trail of all sent penalty emails
- **streaks** — Per-user streak tracking

---

## ⚠️ Legal and Consent

This is a **student project** built for educational purposes. Please read:

- **All image sharing requires explicit opt-in.** Partners must click a confirmation link before any images can be sent to them. No images are sent without `consented_at` being set in the database.
- **Partners can revoke consent at any time** by clicking the unsubscribe link in any email they receive.
- **You can delete your data** — use the Settings page to delete your uploaded image and account.
- **Images are auto-deleted** after 30 days (tracked via `expires_at` field — cleanup cron is a future TODO).
- **No data is sold or shared** beyond the accountability partner you explicitly invite.
- This app is not intended for harassment. The "blackmail" framing is tongue-in-cheek self-accountability. Don't be a jerk.

---

## Future Features

- **OAuth social posting** — Post a walk-of-shame tweet when you fail a session
- **PWA + push notifications** — Get nagged even when the tab isn't open
- **Streak badges and leaderboards** — Compete with friends (or enemies)
- **Commitment contracts** — Set stakes ahead of time (charity donation, etc.)
- **Forgiveness window** — Short grace period before escalation kicks in
- **Mobile app** — Because you'll procrastinate on your phone too

---

## Contributing

This is a student project, but PRs are welcome. If you find a bug or have a feature idea, open an issue. Keep the snarky tone intact — it's load-bearing.
