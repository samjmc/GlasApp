/**
 * /api/profile — the signed-in user's own profile.
 *
 * Supabase Auth owns the account (email, sign-in, role). The app's side is one row in
 * politics.users, read and written only through server/account/profile.ts.
 */
import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import multer from 'multer';
import fs from 'fs';
import { isAdminUser, requireAuth } from '../auth';
import * as profiles from '../account/profile';
import { IMAGE_EXTENSIONS, UPLOAD_DIR, removeProfileImages } from '../account/profileImages';
import { formatError, formatSuccess } from '../utils/responseFormatters';
import { requestLogger } from '../utils/logger';

const router = Router();

const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

const upload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => {
      fs.mkdirSync(UPLOAD_DIR, { recursive: true });
      cb(null, UPLOAD_DIR);
    },
    filename: (req, file, cb) => cb(null, `${req.user!.id}-${Date.now()}${IMAGE_EXTENSIONS[file.mimetype]}`),
  }),
  limits: { fileSize: MAX_IMAGE_BYTES },
  fileFilter: (_req, file, cb) => cb(null, Object.prototype.hasOwnProperty.call(IMAGE_EXTENSIONS, file.mimetype)),
});

const profileUpdateSchema = z.object({
  firstName: z.string().max(100).optional(),
  lastName: z.string().max(100).optional(),
  county: z.string().max(50).optional(),
  bio: z.string().max(2000).optional(),
});

function view(req: Request, row: Parameters<typeof profiles.publicProfile>[0]) {
  return { ...profiles.publicProfile(row), email: req.user!.email ?? null };
}

/** GET /api/profile/me */
router.get('/me', requireAuth, async (req: Request, res: Response) => {
  const log = requestLogger(req);
  try {
    const row = await profiles.ensureProfile(req.user!.id);
    res.json(formatSuccess({ user: view(req, row), isAdmin: isAdminUser(req.user!) }));
  } catch (error) {
    log.error({ err: error }, 'Failed to load profile');
    res.status(500).json(formatError('INTERNAL_ERROR', 'Failed to load profile'));
  }
});

/** PATCH /api/profile/me — edit the caller's own name, county and bio. */
router.patch('/me', requireAuth, async (req: Request, res: Response) => {
  const log = requestLogger(req);
  try {
    const edits = profileUpdateSchema.parse(req.body);
    const row = await profiles.updateProfile(req.user!.id, edits);
    res.json(formatSuccess({ user: view(req, row) }));
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json(formatError('VALIDATION_ERROR', 'Validation error', { errors: error.errors }));
    }
    log.error({ err: error }, 'Failed to update profile');
    res.status(500).json(formatError('INTERNAL_ERROR', 'Failed to update profile'));
  }
});

/** POST /api/profile/image */
const singleImage = upload.single('profileImage');

router.post(
  '/image',
  requireAuth,
  // A file over the size limit is the caller's mistake: 400, not the error handler's 500.
  (req, res, next) =>
    singleImage(req, res, (err) =>
      err instanceof multer.MulterError ? res.status(400).json(formatError('VALIDATION_ERROR', err.message)) : next(err),
    ),
  async (req: Request, res: Response) => {
    const log = requestLogger(req);
    try {
      if (!req.file) return res.status(400).json(formatError('VALIDATION_ERROR', 'No image file provided'));
      const imageUrl = `/uploads/${req.file.filename}`;
      await profiles.setProfileImage(req.user!.id, imageUrl);
      await removeProfileImages(req.user!.id, req.file.filename);
      res.json(formatSuccess({ imageUrl }));
    } catch (error) {
      log.error({ err: error }, 'Profile image upload failed');
      res.status(500).json(formatError('INTERNAL_ERROR', 'Failed to upload profile image'));
    }
  },
);

export default router;
