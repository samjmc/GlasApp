/**
 * /api/profile — the signed-in user's own profile.
 *
 * Accounts live in Supabase Auth. This router owns the application-side profile row in
 * `users`, keyed by the Supabase user id, and is the only place it is written.
 *
 * It replaced `authRoutes.ts`, which carried a second, parallel account system:
 * email+password registration writing rows with a freshly generated UUID that could
 * never match a Supabase identity, a session login the client never called, and a
 * `verify-phone-code` endpoint that took the user id from the request body and so let
 * anyone mark any account's phone verified. All of that is gone.
 */
import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { isAdminUser, requireAuth } from '../auth';
import { storage } from '../storage';
import { sendSMS } from '../services/twilioService';
import { generateVerificationCode, getVerificationExpiration } from '../services/verificationService';
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

const PHONE_E164 = /^\+[1-9]\d{1,14}$/;
const VERIFICATION_CODE_MINUTES = 10;

const profileUpdateSchema = z.object({
  firstName: z.string().max(100).optional(),
  lastName: z.string().max(100).optional(),
  county: z.string().max(100).optional(),
  bio: z.string().max(2000).optional(),
  phoneNumber: z.string().regex(PHONE_E164, 'Phone number must be in E.164 format, e.g. +353871234567').optional(),
});

/** Strip anything the caller should not see back. */
function publicProfile(user: Record<string, unknown>) {
  const { password: _password, verificationCode: _code, verificationCodeExpiresAt: _expiry, ...rest } = user;
  return rest;
}

/**
 * The profile row for the signed-in user, created on first sight.
 *
 * Supabase owns the account, so the first authenticated request is the first time this
 * side of the app hears about them. Creating the row here means there is no separate
 * registration step that can leave the two out of step.
 */
async function ensureProfile(req: Request) {
  const { id, email } = req.user!;
  const existing = await storage.getUser(id);
  if (existing) return existing;
  return storage.upsertUser({ id, email: email ?? null });
}

/** GET /api/profile/me */
router.get('/me', requireAuth, async (req: Request, res: Response) => {
  const log = requestLogger(req);
  try {
    res.json(formatSuccess({
      user: publicProfile(await ensureProfile(req) as Record<string, unknown>),
      isAdmin: isAdminUser(req.user!),
    }));
  } catch (error) {
    log.error({ err: error }, 'Failed to load profile');
    res.status(500).json(formatError('INTERNAL_ERROR', 'Failed to load profile'));
  }
});

/** PATCH /api/profile/me */
router.patch('/me', requireAuth, async (req: Request, res: Response) => {
  const log = requestLogger(req);
  try {
    const updates = profileUpdateSchema.parse(req.body);
    const userId = req.user!.id;
    await ensureProfile(req);

    if (updates.phoneNumber) {
      const owner = await storage.getUserByPhoneNumber(updates.phoneNumber);
      if (owner && owner.id !== userId) {
        return res.status(400).json(formatError('DUPLICATE_RESOURCE', 'That phone number is already in use'));
      }
    }

    let updated = await storage.updateUser(userId, updates);
    let requiresPhoneVerification = false;

    // A new number is unverified until the code comes back.
    if (updates.phoneNumber) {
      const code = generateVerificationCode(6);
      updated = await storage.updateUser(userId, { phoneVerified: 0 });
      await storage.setVerificationCode(userId, code, getVerificationExpiration(VERIFICATION_CODE_MINUTES));
      const sent = await sendSMS({
        to: updates.phoneNumber,
        body: `Your Glas Politics verification code is ${code}. It expires in ${VERIFICATION_CODE_MINUTES} minutes.`,
      });
      requiresPhoneVerification = true;
      if (!sent.success) log.warn({ reason: sent.message }, 'Verification SMS not sent');
    }

    res.json(
      formatSuccess({
        user: publicProfile(updated as unknown as Record<string, unknown>),
        requiresPhoneVerification,
      }),
    );
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json(formatError('VALIDATION_ERROR', 'Validation error', { errors: error.errors }));
    }
    log.error({ err: error }, 'Failed to update profile');
    res.status(500).json(formatError('INTERNAL_ERROR', 'Failed to update profile'));
  }
});

/** POST /api/profile/phone/verify — confirm the SMS code for the caller's own number. */
router.post('/phone/verify', requireAuth, async (req: Request, res: Response) => {
  const log = requestLogger(req);
  try {
    const { code } = z.object({ code: z.string().length(6, 'Verification code must be 6 digits') }).parse(req.body);
    const verified = await storage.verifyUserPhone(req.user!.id, code);
    if (!verified) {
      return res.status(400).json(formatError('VALIDATION_ERROR', 'Invalid or expired verification code'));
    }
    res.json(formatSuccess({ message: 'Phone number verified' }));
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json(formatError('VALIDATION_ERROR', 'Validation error', { errors: error.errors }));
    }
    log.error({ err: error }, 'Phone verification failed');
    res.status(500).json(formatError('INTERNAL_ERROR', 'Failed to verify phone number'));
  }
});

/** POST /api/profile/phone/resend */
router.post('/phone/resend', requireAuth, async (req: Request, res: Response) => {
  const log = requestLogger(req);
  try {
    const userId = req.user!.id;
    const user = await storage.getUser(userId);
    if (!user?.phoneNumber) {
      return res.status(400).json(formatError('VALIDATION_ERROR', 'No phone number on this account'));
    }
    const code = generateVerificationCode(6);
    await storage.setVerificationCode(userId, code, getVerificationExpiration(VERIFICATION_CODE_MINUTES));
    const sent = await sendSMS({
      to: user.phoneNumber,
      body: `Your Glas Politics verification code is ${code}. It expires in ${VERIFICATION_CODE_MINUTES} minutes.`,
    });
    if (!sent.success) {
      return res.status(502).json(formatError('OPERATION_FAILED', 'Could not send the verification code'));
    }
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
    if (!req.file) {
      return res.status(400).json(formatError('VALIDATION_ERROR', 'No image file provided'));
    }
    const imageUrl = `/uploads/${req.file.filename}`;
    await storage.updateUser(req.user!.id, { profileImageUrl: imageUrl });
    res.json(formatSuccess({ imageUrl }));
  } catch (error) {
    log.error({ err: error }, 'Profile image upload failed');
    res.status(500).json(formatError('INTERNAL_ERROR', 'Failed to upload profile image'));
  }
});

export default router;
