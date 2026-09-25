/**
 * /api/profile — the signed-in user's own profile.
 *
 * Supabase Auth owns the account (email, sign-in, role). The app's side is one row in
 * politics.users, read and written only through server/account/profile.ts.
 */
import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { isAdminUser, requireAuth } from '../auth';
import { PHONE_CODE_MINUTES, PHONE_E164, issueCode } from '../account/phone';
import * as profiles from '../account/profile';
import { sendSMS } from '../services/twilioService';
import { formatError, formatSuccess } from '../utils/responseFormatters';
import { requestLogger } from '../utils/logger';

const router = Router();

const UPLOAD_DIR = path.join(process.cwd(), 'public', 'uploads');
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

const upload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => {
      fs.mkdirSync(UPLOAD_DIR, { recursive: true });
      cb(null, UPLOAD_DIR);
    },
    filename: (req, file, cb) => {
      // Name by user id so one account cannot fill the disk with distinct files.
      const ext = path.extname(file.originalname).toLowerCase();
      cb(null, `${req.user!.id}-${Date.now()}${ext}`);
    },
  }),
  limits: { fileSize: MAX_IMAGE_BYTES },
  fileFilter: (_req, file, cb) => {
    cb(null, ['image/png', 'image/jpeg', 'image/webp', 'image/gif'].includes(file.mimetype));
  },
});

const profileUpdateSchema = z.object({
  firstName: z.string().max(100).optional(),
  lastName: z.string().max(100).optional(),
  county: z.string().max(50).optional(),
  bio: z.string().max(2000).optional(),
  phoneNumber: z.string().regex(PHONE_E164, 'Phone number must be in E.164 format, e.g. +353871234567').optional(),
});

function view(req: Request, row: Parameters<typeof profiles.publicProfile>[0]) {
  return { ...profiles.publicProfile(row), email: req.user!.email ?? null };
}

async function sendCode(userId: string, phoneNumber: string) {
  const issued = issueCode(userId);
  await profiles.startPhoneVerification(userId, phoneNumber, issued);
  return sendSMS({
    to: phoneNumber,
    body: `Your Glas Politics verification code is ${issued.code}. It expires in ${PHONE_CODE_MINUTES} minutes.`,
  });
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

/** PATCH /api/profile/me — a new phone number is stored unverified and a code is texted to it. */
router.patch('/me', requireAuth, async (req: Request, res: Response) => {
  const log = requestLogger(req);
  try {
    const { phoneNumber, ...edits } = profileUpdateSchema.parse(req.body);
    const userId = req.user!.id;

    if (phoneNumber && (await profiles.phoneTakenByOther(userId, phoneNumber))) {
      return res.status(400).json(formatError('DUPLICATE_RESOURCE', 'That phone number is already in use'));
    }

    let row = await profiles.updateProfile(userId, edits);
    let requiresPhoneVerification = false;
    if (phoneNumber && (phoneNumber !== row.phoneNumber || !row.phoneVerified)) {
      const sent = await sendCode(userId, phoneNumber);
      if (!sent.success) log.warn({ reason: sent.message }, 'Verification SMS not sent');
      requiresPhoneVerification = true;
      row = (await profiles.getProfile(userId))!;
    }

    res.json(formatSuccess({ user: view(req, row), requiresPhoneVerification }));
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json(formatError('VALIDATION_ERROR', 'Validation error', { errors: error.errors }));
    }
    log.error({ err: error }, 'Failed to update profile');
    res.status(500).json(formatError('INTERNAL_ERROR', 'Failed to update profile'));
  }
});

const VERIFY_MESSAGES = {
  wrong: 'That code is not right',
  expired: 'That code has expired; ask for a new one',
  no_code: 'No code is waiting; ask for a new one',
  too_many_attempts: 'Too many wrong codes; ask for a new one',
} as const;

/** POST /api/profile/phone/verify — confirm the SMS code for the caller's own number. */
router.post('/phone/verify', requireAuth, async (req: Request, res: Response) => {
  const log = requestLogger(req);
  try {
    const { code } = z.object({ code: z.string().regex(/^\d{6}$/, 'Verification code must be 6 digits') }).parse(req.body);
    const result = await profiles.verifyPhone(req.user!.id, code);
    if (result !== 'verified') return res.status(400).json(formatError('VALIDATION_ERROR', VERIFY_MESSAGES[result]));
    res.json(formatSuccess({ message: 'Phone number verified' }));
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json(formatError('VALIDATION_ERROR', 'Validation error', { errors: error.errors }));
    }
    log.error({ err: error }, 'Phone verification failed');
    res.status(500).json(formatError('INTERNAL_ERROR', 'Failed to verify phone number'));
  }
});

/** POST /api/profile/phone/resend — a fresh code for the number already on the account. */
router.post('/phone/resend', requireAuth, async (req: Request, res: Response) => {
  const log = requestLogger(req);
  try {
    const userId = req.user!.id;
    const row = await profiles.getProfile(userId);
    if (!row?.phoneNumber) return res.status(400).json(formatError('VALIDATION_ERROR', 'No phone number on this account'));
    if (row.phoneVerified) return res.status(400).json(formatError('VALIDATION_ERROR', 'That number is already verified'));
    const sent = await sendCode(userId, row.phoneNumber);
    if (!sent.success) return res.status(502).json(formatError('OPERATION_FAILED', 'Could not send the verification code'));
    res.json(formatSuccess({ message: 'Verification code sent' }));
  } catch (error) {
    log.error({ err: error }, 'Failed to resend verification code');
    res.status(500).json(formatError('INTERNAL_ERROR', 'Failed to resend verification code'));
  }
});

/** POST /api/profile/image */
router.post('/image', requireAuth, upload.single('profileImage'), async (req: Request, res: Response) => {
  const log = requestLogger(req);
  try {
    if (!req.file) return res.status(400).json(formatError('VALIDATION_ERROR', 'No image file provided'));
    const imageUrl = `/uploads/${req.file.filename}`;
    await profiles.setProfileImage(req.user!.id, imageUrl);
    res.json(formatSuccess({ imageUrl }));
  } catch (error) {
    log.error({ err: error }, 'Profile image upload failed');
    res.status(500).json(formatError('INTERNAL_ERROR', 'Failed to upload profile image'));
  }
});

export default router;
