import multer from 'multer';
import sharp from 'sharp';
import path from 'path';
import fs from 'fs';
import { v4 as uuidv4 } from 'uuid';
import { config } from '../config';

export const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (file.mimetype.startsWith('image/')) cb(null, true);
    else cb(new Error('Only image files are allowed'));
  },
});

export async function saveImage(buffer: Buffer, folder: string = 'general'): Promise<string> {
  const dir = path.join(config.uploadPath, folder);
  fs.mkdirSync(dir, { recursive: true });

  const filename = `${uuidv4()}.webp`;
  const filepath = path.join(dir, filename);

  await sharp(buffer)
    .resize(1200, 1200, { fit: 'inside', withoutEnlargement: true })
    .webp({ quality: 85 })
    .toFile(filepath);

  return `/uploads/${folder}/${filename}`;
}

export function deleteImage(url: string): void {
  try {
    const relative = url.replace(/^.*\/uploads\//, '');
    const filepath = path.join(config.uploadPath, relative);
    if (fs.existsSync(filepath)) fs.unlinkSync(filepath);
  } catch {
    // non-fatal — old Cloudinary URLs or missing files are fine
  }
}
