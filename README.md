# FiveMoreMins ☠️

> The anti-procrastination app that fights dirty.

You have goals. You also have YouTube. This app makes sure those two things don't coexist peacefully.

**How it works:**
1. Upload an embarrassing photo
2. Enter your accountability partner's email
3. Start a focus session
4. Leave the tab for 30+ minutes? Your photo gets sent. No mercy. No refunds.

---

## ⚡ Quick Setup

**Requirements:** Node.js 18+, two terminal windows, and a slightly self-destructive personality.

### Backend
```bash
cd backend
npm install
cp .env.example .env
# Edit .env with your EmailJS credentials (see below)
npm run dev
```

### Frontend
```bash
cd frontend
npm install
npm run dev
```

Open [http://localhost:5173](http://localhost:5173) — that's it.

---

## 📧 Setting Up Email (EmailJS — Free, No SMTP)

The easiest way. Go to [emailjs.com](https://www.emailjs.com/) and:

1. **Sign up** for a free account (200 emails/month — plenty for an MVP)
2. **Add an Email Service** → Connect your Gmail or any email provider
3. **Create an Email Template** with these variables:
   - `{{to_email}}` — recipient
   - `{{from_email}}` — who failed
   - `{{away_minutes}}` — how long they were gone
   - `{{message}}` — the snarky message
   - `{{timestamp}}` — when it happened
4. Go to **Account** → copy your **Public Key** and **Private Key**
5. Copy your **Service ID** and **Template ID**
6. Add them to `backend/.env`:

```env
EMAILJS_SERVICE_ID=service_xxxxxxx
EMAILJS_TEMPLATE_ID=template_xxxxxxx
EMAILJS_PUBLIC_KEY=xxxxxxxxxxxxxxx
EMAILJS_PRIVATE_KEY=xxxxxxxxxxxxxxx
```

### Alternative: Gmail + App Password (nodemailer)

If you'd rather use Gmail directly:

1. Enable 2FA on your Google account
2. Go to [Google App Passwords](https://myaccount.google.com/apppasswords)
3. Create an app password for "Mail"
4. Add to `backend/.env`:

```env
EMAIL_METHOD=nodemailer
GMAIL_USER=your.email@gmail.com
GMAIL_APP_PASSWORD=xxxx xxxx xxxx xxxx
```

---

## 🔄 How the App Works

```
User opens site
    ↓
Setup page (email + partner email + upload photo)
    ↓
Focus session starts → timer begins
    ↓
[Tab goes hidden] → start away timer
    ↓
Tab comes back:
  • 5+ min away   → passive-aggressive warning modal
  • 15+ min away  → more aggressive warning
  • 30+ min away  → AGGRESSIVE + send email to partner 💀
    ↓
Session ends → update streak + dashboard
    ↓
Dashboard shows stats, streaks, hall of shame
```

---

## 🛠 Tech Stack

| Layer | Tech |
|-------|------|
| Frontend | React + TypeScript + Vite |
| Backend | Node.js + Express + TypeScript |
| Database | SQLite via better-sqlite3 |
| Email | EmailJS (or nodemailer fallback) |
| File upload | multer → local filesystem |
| Auth | Token-based (stored in localStorage) |

---

## 📁 Project Structure

```
FiveMoreMins/
├── frontend/          # React + Vite app
│   └── src/
│       ├── components/    # All the UI components
│       ├── hooks/         # useVisibility custom hook
│       └── utils/         # API helpers + message banks
├── backend/           # Express server
│   └── src/
│       ├── routes/        # API route handlers
│       ├── db.ts          # SQLite setup (auto-creates tables)
│       ├── email.ts       # Email sending (EmailJS + nodemailer)
│       └── storage.ts     # Multer image upload config
└── README.md
```

---

## ⚠️ Legal Disclaimer

This is a **student project** built for fun and motivation. The "blackmail" system is:
- Fully consensual (users agree before setting up)
- Not actually malicious — just embarrassing
- For entertainment and accountability purposes only

Don't actually blackmail people. That's illegal. This app is for consenting friends who want to be held accountable.

The app stores minimal data: your email, your partner's email, and whatever photo you upload. No passwords. No tracking. Data stays on your own machine (the SQLite file lives in `backend/fivemoremins.db`).

---

## 🎓 Student Project Notes

Built as a full-stack web development project demonstrating:
- React hooks and custom hooks (visibility API)
- REST API design with Express
- SQLite database with auto-migration
- File upload handling
- Session-based authentication
- Third-party email integration

No frameworks were harmed in the making of this app. The CSS is entirely hand-written.

---

*Made with excessive caffeine and mild self-loathing.* 🫠
