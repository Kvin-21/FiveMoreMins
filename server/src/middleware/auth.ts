import { Request, Response, NextFunction } from 'express';

// Teach express-session about our custom session fields.
// This declaration merges into the existing SessionData interface globally.
declare module 'express-session' {
  interface SessionData {
    userId: number;
  }
}

export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  if (!req.session.userId) {
    res.status(401).json({ error: 'Unauthorized. Please log in.' });
    return;
  }
  next();
}
