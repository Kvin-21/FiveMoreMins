// Load all environment variables with sane defaults.
// Copy .env.example to .env and fill in the real values before running.

export const config = {
  port: parseInt(process.env.PORT || '3001', 10),
  sessionSecret: process.env.SESSION_SECRET || 'dev-secret-please-change-me',
  smtp: {
    host: process.env.SMTP_HOST || 'smtp.sendgrid.net',
    port: parseInt(process.env.SMTP_PORT || '587', 10),
    user: process.env.SMTP_USER || '',
    pass: process.env.SMTP_PASS || '',
  },
  fromEmail: process.env.FROM_EMAIL || 'noreply@fivemoremins.com',
  clientUrl: process.env.CLIENT_URL || 'http://localhost:5173',
  // Used to build confirmation links in emails - should point at the Express server
  serverUrl: process.env.SERVER_URL || 'http://localhost:3001',
};
