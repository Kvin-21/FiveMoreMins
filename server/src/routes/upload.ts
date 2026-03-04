import { Router, Request, Response } from 'express';
import { upload, saveImage } from '../services/storage';
import { requireAuth } from '../middleware/auth';
import { generalRateLimit } from '../middleware/rateLimit';

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

export default router;
