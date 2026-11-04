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
import type { UserRow } from '@shared/schema/accounts';
import * as profiles from '../account/profile';
import { IMAGE_EXTENSIONS, UPLOAD_DIR, removeProfileImages } from '../account/profileImages';
import { AppError } from '../utils/errors';
import { formatError, formatSuccess } from '../utils/responseFormatters';

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
  firstName: z.string().max(profiles.PROFILE_LIMITS.firstName).optional(),
  lastName: z.string().max(profiles.PROFILE_LIMITS.lastName).optional(),
  county: z.string().max(profiles.PROFILE_LIMITS.county).optional(),
  bio: z.string().max(profiles.PROFILE_LIMITS.bio).optional(),
});

function view(req: Request, row: UserRow) {
  return { ...row, email: req.user!.email ?? null };
}

/** GET /api/profile/me. Every signed-in page asks for it, so it is where older metadata is copied in. */
router.get('/me', requireAuth, async (req: Request, res: Response) => {
  const row = await profiles.backfillFromMetadata(await profiles.ensureProfile(req.user!.id), req.user!.userMetadata);
  res.json(formatSuccess({ user: view(req, row), isAdmin: isAdminUser(req.user!) }));
});

/** PATCH /api/profile/me — edit the caller's own name, county and bio. */
router.patch('/me', requireAuth, async (req: Request, res: Response) => {
  // A bad edit is a ZodError: the error handler answers it with 400 VALIDATION_ERROR.
  const edits = profileUpdateSchema.parse(req.body);
  const row = await profiles.updateProfile(req.user!.id, edits);
  res.json(formatSuccess({ user: view(req, row) }));
});

/** POST /api/profile/image */
const singleImage = upload.single('profileImage');

router.post(
  '/image',
  requireAuth,
  // A file over the size limit is the caller's mistake: 400, not the error handler's 500.
  (req, res, next) =>
    singleImage(req, res, (err) =>
      next(err instanceof multer.MulterError ? new AppError(400, 'VALIDATION_ERROR', err.message) : err),
    ),
  async (req: Request, res: Response) => {
    if (!req.file) return res.status(400).json(formatError('VALIDATION_ERROR', 'No image file provided'));
    const imageUrl = `/uploads/${req.file.filename}`;
    await profiles.setProfileImage(req.user!.id, imageUrl);
    await removeProfileImages(req.user!.id, req.file.filename);
    res.json(formatSuccess({ imageUrl }));
  },
);

export default router;
