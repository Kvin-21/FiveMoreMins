import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { v4 as uuidv4 } from 'uuid';
import db from '../db/connection';

export interface ImageRecord {
  id: number;
  user_id: number;
  filename: string;
  original_name: string;
  mime_type: string;
  uploaded_at: number;
  expires_at: number | null;
  deleted_at: number | null;
}

const diskStorage = multer.diskStorage({
  destination: (req, _file, cb) => {
    // requireAuth runs before this, so userId is guaranteed
    const userId = req.session.userId || 0;
    const uploadDir = path.resolve(process.cwd(), 'uploads', String(userId));
    fs.mkdirSync(uploadDir, { recursive: true });
    cb(null, uploadDir);
  },
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `${uuidv4()}${ext}`);
  },
});

export const upload = multer({
  storage: diskStorage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB — we don't need your 4K RAW files
  fileFilter: (_req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'));
    }
  },
});

/** Persist the uploaded file metadata to the images table and return the record. */
export async function saveImage(
  file: Express.Multer.File,
  userId: number,
): Promise<ImageRecord> {
  const result = db
    .prepare(
      `INSERT INTO images (user_id, filename, original_name, mime_type)
       VALUES (?, ?, ?, ?)`,
    )
    .run(userId, file.filename, file.originalname, file.mimetype);

  const image = db
    .prepare('SELECT * FROM images WHERE id = ?')
    .get(result.lastInsertRowid) as ImageRecord;

  return image;
}

/** Return the absolute filesystem path for an image, or null if it doesn't exist / is deleted. */
export function getImagePath(imageId: number): string | null {
  const image = db
    .prepare('SELECT * FROM images WHERE id = ? AND deleted_at IS NULL')
    .get(imageId) as ImageRecord | undefined;

  if (!image) return null;

  return path.resolve(process.cwd(), 'uploads', String(image.user_id), image.filename);
}

/** Soft-delete in DB and remove the file from disk. */
export function deleteImage(imageId: number): void {
  const image = db
    .prepare('SELECT * FROM images WHERE id = ? AND deleted_at IS NULL')
    .get(imageId) as ImageRecord | undefined;

  if (!image) return;

  db.prepare('UPDATE images SET deleted_at = ? WHERE id = ?').run(
    Math.floor(Date.now() / 1000),
    imageId,
  );

  const filePath = path.resolve(
    process.cwd(),
    'uploads',
    String(image.user_id),
    image.filename,
  );

  try {
    fs.unlinkSync(filePath);
  } catch (err) {
    // File might already be gone — not fatal
    console.error('[storage] Failed to delete image file from disk:', err);
  }
}
