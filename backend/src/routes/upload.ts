import { Router, Request, Response } from 'express';
import path from 'path';
import { requireAuth } from '../middleware';
import { upload } from '../storage';
import db from '../db';

const router = Router();

type AuthRequest = Request & { user: { id: number; email: string; partner_email: string; image_path: string } };

// POST /api/upload - upload an image
router.post('/', requireAuth, upload.single('image'), (req: Request, res: Response) => {
  const user = (req as AuthRequest).user;

  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded' });
  }

  const imagePath = req.file.filename;

  // Save the image path to the user's record
  db.prepare('UPDATE users SET image_path = ? WHERE id = ?').run(imagePath, user.id);

  return res.json({
    success: true,
    imagePath,
    imageUrl: `/uploads/${imagePath}`,
  });
});

// DELETE /api/upload - remove user's image
router.delete('/', requireAuth, (req: Request, res: Response) => {
  const user = (req as AuthRequest).user;

  db.prepare('UPDATE users SET image_path = NULL WHERE id = ?').run(user.id);

  return res.json({ success: true });
});

export default router;
