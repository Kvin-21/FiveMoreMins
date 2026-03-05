import { Router, Request, Response } from 'express';
import db from '../db/connection';
import { upload, saveImage, deleteImage } from '../services/storage';
import { requireAuth } from '../middleware/auth';
import { generalRateLimit } from '../middleware/rateLimit';
import type { ImageRecord } from '../services/storage';

const router = Router();

/**
 * POST /api/upload-image
 * Upload a single image. This becomes the "stake" — the image sent to your
 * partner if you blow your focus session.
 */
router.post(
  '/upload-image',
  requireAuth,
  generalRateLimit,
  upload.single('image'),
  async (req: Request, res: Response) => {
    try {
      if (!req.file) {
        res.status(400).json({ error: 'No image provided.' });
        return;
      }

      const image = await saveImage(req.file, req.session.userId!);
      res.json({ image });
    } catch (err) {
      console.error('[upload] Error:', err);
      res.status(500).json({ error: 'Upload failed.' });
    }
  },
);

/**
 * GET /api/images
 * Return the current user's most recent active image (or null).
 */
router.get('/images', requireAuth, generalRateLimit, (req: Request, res: Response) => {
  try {
    const userId = req.session.userId!;
    const image = db
      .prepare(
        `SELECT * FROM images
         WHERE user_id = ? AND deleted_at IS NULL
         ORDER BY uploaded_at DESC LIMIT 1`,
      )
      .get(userId) as ImageRecord | undefined;

    res.json({ image: image ?? null });
  } catch (err) {
    console.error('[images] Get error:', err);
    res.status(500).json({ error: 'Failed to fetch image.' });
  }
});

/**
 * DELETE /api/images/:id
 * Soft-delete the image if it belongs to the current user.
 */
router.delete('/images/:id', requireAuth, generalRateLimit, (req: Request, res: Response) => {
  try {
    const userId = req.session.userId!;
    const imageId = parseInt(req.params.id, 10);

    const image = db
      .prepare('SELECT * FROM images WHERE id = ? AND user_id = ? AND deleted_at IS NULL')
      .get(imageId, userId) as ImageRecord | undefined;

    if (!image) {
      res.status(404).json({ error: 'Image not found.' });
      return;
    }

    deleteImage(imageId);
    res.status(204).end();
  } catch (err) {
    console.error('[images] Delete error:', err);
    res.status(500).json({ error: 'Failed to delete image.' });
  }
});

export default router;
