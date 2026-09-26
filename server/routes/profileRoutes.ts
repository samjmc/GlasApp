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
import { PHONE_CODE_MINUTES, PHONE_E164, issueCode } from '../account/phone';
import * as profiles from '../account/profile';
import { IMAGE_EXTENSIONS, UPLOAD_DIR, removeProfileImages } from '../account/profileImages';
import { smsRateLimit } from '../middleware/rateLimit';
import { sendSMS } from '../services/twilioService';
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
  phoneNumber: z.string().regex(PHONE_E164, 'Phone number must be in E.164 format, e.g. +353871234567').optional(),
});

function view(req: Request, row: Parameters<typeof profiles.publicProfile>[0]) {
  return { ...profiles.publicProfile(row), email: req.user!.email ?? null };
}

/** Store a fresh code and text it. 'too_soon' and 'taken' send nothing. */
async function sendCode(userId: string, phoneNumber: string): Promise<'sent' | 'not_sent' | 'too_soon' | 'taken'> {
  const issued = issueCode(userId);
  const started = await profiles.startPhoneVerification(userId, phoneNumber, issued);
  if (started !== 'started') return started;
  const sms = await sendSMS({
    to: phoneNumber,
    body: `Your Glas Politics verification code is ${issued.code}. It expires in ${PHONE_CODE_MINUTES} minutes.`,
  });
  return sms.success ? 'sent' : 'not_sent';
}

const NOT_SENT = {
  too_soon: [429, 'RATE_LIMITED', 'Wait a minute before asking for another code'],
  taken: [400, 'DUPLICATE_RESOURCE', 'That phone number is already in use'],
} as const;

/** A parallel claim on the same number can still hit the unique index. */
const isUniqueViolation = (error: unknown) => (error as { code?: string } | null)?.code === '23505';

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

/**
 * PATCH /api/profile/me — a new phone number is stored unverified and a code is texted to it.
 * The number is handled first, so a refused number saves nothing. Re-sending a code for the
 * same number is /phone/resend.
 */
router.patch('/me', requireAuth, smsRateLimit, async (req: Request, res: Response) => {
  const log = requestLogger(req);
  try {
    const { phoneNumber, ...edits } = profileUpdateSchema.parse(req.body);
    const userId = req.user!.id;

    const current = await profiles.ensureProfile(userId);
    const requiresPhoneVerification = Boolean(phoneNumber && phoneNumber !== current.phoneNumber);
    if (requiresPhoneVerification) {
      const outcome = await sendCode(userId, phoneNumber!);
      if (outcome === 'too_soon' || outcome === 'taken') {
        const [status, code, message] = NOT_SENT[outcome];
        return res.status(status).json(formatError(code, message));
      }
      if (outcome === 'not_sent') log.warn('Verification SMS not sent');
    }

    const row = await profiles.updateProfile(userId, edits);
    res.json(formatSuccess({ user: view(req, row), requiresPhoneVerification }));
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json(formatError('VALIDATION_ERROR', 'Validation error', { errors: error.errors }));
    }
    if (isUniqueViolation(error)) return res.status(400).json(formatError('DUPLICATE_RESOURCE', NOT_SENT.taken[2]));
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
router.post('/phone/resend', requireAuth, smsRateLimit, async (req: Request, res: Response) => {
  const log = requestLogger(req);
  try {
    const userId = req.user!.id;
    const row = await profiles.getProfile(userId);
    if (!row?.phoneNumber) return res.status(400).json(formatError('VALIDATION_ERROR', 'No phone number on this account'));
    if (row.phoneVerified) return res.status(400).json(formatError('VALIDATION_ERROR', 'That number is already verified'));
    const outcome = await sendCode(userId, row.phoneNumber);
    if (outcome === 'too_soon' || outcome === 'taken') {
      const [status, code, message] = NOT_SENT[outcome];
      return res.status(status).json(formatError(code, message));
    }
    if (outcome === 'not_sent') return res.status(502).json(formatError('OPERATION_FAILED', 'Could not send the verification code'));
    res.json(formatSuccess({ message: 'Verification code sent' }));
  } catch (error) {
    log.error({ err: error }, 'Failed to resend verification code');
    res.status(500).json(formatError('INTERNAL_ERROR', 'Failed to resend verification code'));
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
