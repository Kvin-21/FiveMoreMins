import { Request, Response, NextFunction } from 'express';
import db from './db';

// Simple token-based auth middleware
// Checks for token in Authorization header or x-auth-token header
export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  const token = req.headers.authorization?.replace('Bearer ', '') || req.headers['x-auth-token'] as string;

  if (!token) {
    res.status(401).json({ error: 'No auth token provided' });
    return;
  }

  const user = db.prepare('SELECT * FROM users WHERE session_token = ?').get(token) as { id: number; email: string; partner_email: string; image_path: string } | undefined;

  if (!user) {
    res.status(401).json({ error: 'Invalid token' });
    return;
  }

  // Attach user to request for route handlers to use
  (req as Request & { user: typeof user }).user = user;
  next();
}
