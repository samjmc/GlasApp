import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { insertUserSchema, User } from '@shared/schema';
import { isAuthenticated } from '../middleware/sessionMiddleware';
import { storage } from '../storage';
import bcrypt from 'bcryptjs';
import multer from 'multer';
import path from 'path';
import fs from 'fs';

// Extend Request type to include user property
interface AuthenticatedRequest extends Request {
  user?: User;
}

// Function to send verification email
async function sendVerificationEmail(email: string, username: string, token: string): Promise<void> {
  // Using Resend API for email sending
  const RESEND_API_KEY = process.env.RESEND_API_KEY;
  
  if (!RESEND_API_KEY) {
    throw new Error('Email service not configured - RESEND_API_KEY missing');
  }

  const verificationUrl = `${process.env.BASE_URL || 'http://localhost:5000'}/api/auth/verify-email?token=${token}`;
  
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${RESEND_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      from: 'Glas Politics <noreply@glaspolitics.com>',
      to: [email],
      subject: 'Verify Your Glas Politics Account',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2>Welcome to Glas Politics, ${username}!</h2>
          <p>Thank you for registering. Please verify your email address to complete your account setup.</p>
          <div style="text-align: center; margin: 30px 0;">
            <a href="${verificationUrl}" 
               style="background-color: #3b82f6; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
              Verify Email Address
            </a>
          </div>
          <p>If you didn't create this account, you can safely ignore this email.</p>
          <p>This link will expire in 24 hours.</p>
        </div>
      `
    })
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to send verification email: ${error}`);
  }
}

// Function to send verification email with 6-digit code
async function sendVerificationEmailWithCode(email: string, username: string, code: string): Promise<void> {
  const RESEND_API_KEY = process.env.RESEND_API_KEY;
  
  if (!RESEND_API_KEY) {
    throw new Error('Email service not configured - RESEND_API_KEY missing');
  }
  
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${RESEND_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      from: 'Glas Politics <noreply@glaspolitics.com>',
      to: [email],
      subject: 'Your Glas Politics Verification Code',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <h2 style="color: #2d5a3b;">Welcome to Glas Politics, ${username}!</h2>
          <p>Thank you for registering. Please use the verification code below to complete your account setup:</p>
          <div style="text-align: center; margin: 30px 0;">
            <div style="background-color: #f3f4f6; padding: 20px; border-radius: 8px; display: inline-block;">
              <span style="font-size: 32px; font-weight: bold; letter-spacing: 8px; color: #2d5a3b;">${code}</span>
            </div>
          </div>
          <p>Enter this code in the verification step to complete your registration.</p>
          <p style="color: #6b7280; font-size: 14px;">If you didn't create this account, you can safely ignore this email.</p>
          <p style="color: #6b7280; font-size: 14px;">This code will expire in 24 hours.</p>
        </div>
      `
    })
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to send verification email: ${error}`);
  }
}

// Function to verify reCAPTCHA token
async function verifyCaptcha(token: string): Promise<boolean> {
  try {
    const secretKey = process.env.RECAPTCHA_SECRET_KEY;
    if (!secretKey) {
      console.warn('RECAPTCHA_SECRET_KEY not configured - allowing registration for development');
      return true; // Allow registration if CAPTCHA is not configured
    }

    if (!token || token.trim() === '') {
      console.log('No CAPTCHA token provided');
      return false;
    }

    console.log('Verifying CAPTCHA token with Google...');
    const response = await fetch('https://www.google.com/recaptcha/api/siteverify', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: `secret=${secretKey}&response=${token}`,
    });

    const data = await response.json();
    console.log('CAPTCHA verification response:', data);
    
    if (data.success) {
      console.log('CAPTCHA verification successful');
      return true;
    } else {
      console.log('CAPTCHA verification failed:', data['error-codes'] || 'Unknown error');
      return false;
    }
  } catch (error) {
    console.error('CAPTCHA verification error:', error);
    return false;
  }
}

// Configure multer for file uploads
const storage_config = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadDir = path.join(process.cwd(), 'public', 'uploads');
    // Ensure upload directory exists
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    // Generate unique filename
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({
  storage: storage_config,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
  },
  fileFilter: function (req, file, cb) {
    // Check if file is an image
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'));
    }
  }
});

const router = Router();

// Helper functions for verification
function generateVerificationCode(length: number = 6): string {
  return Math.floor(Math.random() * Math.pow(10, length)).toString().padStart(length, '0');
}

function getVerificationExpiration(minutes: number = 10): Date {
  return new Date(Date.now() + minutes * 60 * 1000);
}

// Step 1: Validate basic info and send verification email (no database creation yet)
router.post('/register-step1', async (req: Request, res: Response) => {
  try {
    const registerSchema = z.object({
      username: z.string().min(3, { message: 'Username must be at least 3 characters' }),
      email: z.string().email({ message: 'Please enter a valid email address' }),
      password: z.string().min(6, { message: 'Password must be at least 6 characters' }),
      confirmPassword: z.string(),
      firstName: z.string().optional(),
      lastName: z.string().optional(),
      captchaToken: z.string()
    }).refine(data => data.password === data.confirmPassword, {
      message: 'Passwords do not match',
      path: ['confirmPassword']
    });

    const validatedData = registerSchema.parse(req.body);
    
    // Verify reCAPTCHA (temporarily disabled for testing)
    console.log('CAPTCHA token received:', validatedData.captchaToken ? 'present' : 'missing');
    const captchaValid = await verifyCaptcha(validatedData.captchaToken);
    console.log('CAPTCHA validation result:', captchaValid);
    
    // Temporarily allow registration even if CAPTCHA fails for testing
    if (!captchaValid) {
      console.warn('CAPTCHA verification failed, but allowing registration for testing');
    }

    // Check if username already exists
    const existingUser = await storage.getUserByUsername(validatedData.username);
    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: 'Username already taken'
      });
    }

    // Check if email already exists
    const existingEmail = await storage.getUserByEmail(validatedData.email);
    if (existingEmail) {
      return res.status(400).json({
        success: false,
        message: 'Email already registered'
      });
    }
    
    // Generate 6-digit verification code for email
    const verificationCode = generateVerificationCode(6);
    
    // Create temporary session ID to track registration progress
    const tempUserId = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
    
    console.log('Temporary user ID created:', tempUserId);
    console.log('Email verification code generated:', verificationCode);
    
    // Store registration data temporarily (in production, use Redis or database temp table)
    // For now, we'll use a simple in-memory store - in production this should be persistent
    global.tempRegistrations = global.tempRegistrations || {};
    global.tempRegistrations[tempUserId] = {
      ...validatedData,
      verificationCode,
      createdAt: new Date(),
      expiresAt: getVerificationExpiration(24 * 60)
    };
    
    try {
      // Send verification email with the 6-digit code
      const { confirmPassword, captchaToken, ...userData } = validatedData;
      await sendVerificationEmailWithCode(userData.email, userData.username || userData.email, verificationCode);
      console.log('Verification email sent successfully to:', userData.email);
    } catch (emailError) {
      console.error('Failed to send verification email:', emailError);
      return res.status(500).json({
        success: false,
        message: 'Failed to send verification email. Please try again.'
      });
    }
    
    res.status(201).json({
      success: true,
      message: 'Please check your email for verification code.',
      tempUserId: tempUserId
    });
  } catch (error) {
    console.error('Registration step 1 error:', error);
    if (error.name === 'ZodError') {
      const firstError = error.errors[0];
      return res.status(400).json({
        success: false,
        message: firstError.message
      });
    }
    res.status(500).json({
      success: false,
      message: 'Registration failed. Please try again.'
    });
  }
});

// Step 2: Update location and phone information in temporary storage
router.post('/register-step2', async (req: Request, res: Response) => {
  try {
    const updateSchema = z.object({
      tempUserId: z.string(),
      county: z.string().optional(),
      phoneNumber: z.string().regex(/^\+[1-9]\d{1,14}$/, { 
        message: 'Phone number must be in international format' 
      }).optional(),
      latitude: z.number().optional(),
      longitude: z.number().optional()
    });

    const validatedData = updateSchema.parse(req.body);
    
    // Get temporary registration data
    global.tempRegistrations = global.tempRegistrations || {};
    const tempData = global.tempRegistrations[validatedData.tempUserId];
    
    if (!tempData) {
      return res.status(404).json({
        success: false,
        message: 'Registration session not found. Please start over.'
      });
    }
    
    // Update temporary data with location and phone info
    const { tempUserId, latitude, longitude, ...updateData } = validatedData;
    global.tempRegistrations[validatedData.tempUserId] = {
      ...tempData,
      ...updateData,
      latitude: latitude?.toString(),
      longitude: longitude?.toString()
    };
    
    res.status(200).json({
      success: true,
      message: 'Information updated successfully'
    });
  } catch (error) {
    console.error('Registration step 2 error:', error);
    if (error.name === 'ZodError') {
      const firstError = error.errors[0];
      return res.status(400).json({
        success: false,
        message: firstError.message
      });
    }
    res.status(500).json({
      success: false,
      message: 'Failed to update information. Please try again.'
    });
  }
});

// Verify email with code and create actual user account
router.post('/verify-email-code', async (req: Request, res: Response) => {
  try {
    const verifySchema = z.object({
      tempUserId: z.string(),
      code: z.string().length(6)
    });

    const { tempUserId, code } = verifySchema.parse(req.body);
    
    // Get temporary registration data
    const tempRegistrations = (global as any).tempRegistrations || {};
    const tempData = tempRegistrations[tempUserId];
    
    if (!tempData) {
      return res.status(404).json({
        success: false,
        message: 'Registration session not found. Please start over.'
      });
    }
    
    // Check if verification code has expired
    if (new Date() > tempData.expiresAt) {
      return res.status(400).json({
        success: false,
        message: 'Verification code has expired. Please start over.'
      });
    }
    
    // Check if verification code matches
    if (tempData.verificationCode === code) {
      // Hash password
      const hashedPassword = await bcrypt.hash(tempData.password, 10);
      
      // Create actual user account now that email is verified
      const { confirmPassword, captchaToken, verificationCode, createdAt, expiresAt, ...userData } = tempData;
      const user = await storage.createUser({
        ...userData,
        password: hashedPassword,
        emailVerified: true
      });
      
      // Clean up temporary data
      delete tempRegistrations[tempUserId];
      
      console.log('User account created successfully with ID:', user.id);
      
      res.status(200).json({
        success: true,
        message: 'Email verified and account created successfully',
        userId: user.id
      });
    } else {
      res.status(400).json({
        success: false,
        message: 'Invalid verification code'
      });
    }
  } catch (error) {
    console.error('Email verification error:', error);
    res.status(500).json({
      success: false,
      message: 'Verification failed. Please try again.'
    });
  }
});

// Verify phone with code (simplified - in production use SMS service)
router.post('/verify-phone-code', async (req: Request, res: Response) => {
  try {
    const verifySchema = z.object({
      userId: z.number(),
      code: z.string().length(6)
    });

    const { userId, code } = verifySchema.parse(req.body);
    
    // For now, accept any 6-digit code starting with '2' (demo purposes)
    // In production, you would verify against SMS codes sent via Twilio
    if (code.startsWith('2')) {
      await storage.updateUser(userId, { phoneVerified: true });
      
      res.status(200).json({
        success: true,
        message: 'Phone verified successfully'
      });
    } else {
      res.status(400).json({
        success: false,
        message: 'Invalid verification code'
      });
    }
  } catch (error) {
    console.error('Phone verification error:', error);
    res.status(500).json({
      success: false,
      message: 'Verification failed. Please try again.'
    });
  }
});

// User registration with email verification (legacy route - keep for compatibility)
router.post('/register', async (req: Request, res: Response) => {
  try {
    // Validate request body
    const registerSchema = insertUserSchema.extend({
      password: z.string().min(6, { message: 'Password must be at least 6 characters' }),
      confirmPassword: z.string(),
      latitude: z.number().optional(),
      longitude: z.number().optional(),
      captchaToken: z.string().optional()
    }).refine(data => data.password === data.confirmPassword, {
      message: 'Passwords do not match',
      path: ['confirmPassword']
    });

    const validatedData = registerSchema.parse(req.body);
    
    // Verify reCAPTCHA
    if (validatedData.captchaToken) {
      const captchaValid = await verifyCaptcha(validatedData.captchaToken);
      if (!captchaValid) {
        return res.status(400).json({
          success: false,
          message: 'Invalid CAPTCHA. Please try again.'
        });
      }
    } else {
      return res.status(400).json({
        success: false,
        message: 'CAPTCHA verification required.'
      });
    }

    // Remove confirmPassword and captchaToken from data before passing to service
    const { confirmPassword, captchaToken, ...userData } = validatedData;
    
    try {
      // Check if username already exists
      const existingUser = await storage.getUserByUsername(userData.username);
      if (existingUser) {
        return res.status(400).json({
          success: false,
          message: 'Username already taken'
        });
      }

      // Check if email already exists
      const existingEmail = await storage.getUserByEmail(userData.email);
      if (existingEmail) {
        return res.status(400).json({
          success: false,
          message: 'Email already registered'
        });
      }
      
      // Hash password
      const hashedPassword = await bcrypt.hash(userData.password, 10);
      
      // Generate email verification token
      const verificationToken = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
      
      // Create user with properly converted coordinates and verification token
      const { latitude, longitude, ...restUserData } = userData;
      const user = await storage.createUser({
        ...restUserData,
        password: hashedPassword,
        latitude: latitude?.toString() || undefined,
        longitude: longitude?.toString() || undefined,
        emailVerified: false
      });
      
      // For now, set users as email verified by default but require email confirmation for login
      // In production, you would implement proper email verification
      try {
        await sendVerificationEmail(user.email, user.username, verificationToken);
        
        return res.status(201).json({
          success: true,
          message: 'Registration successful! A verification email has been sent to your email address.',
          userId: user.id
        });
      } catch (emailError) {
        console.error('Failed to send verification email:', emailError);
        
        // If email fails, still allow the user to proceed but mark as unverified
        return res.status(201).json({
          success: true,
          message: 'Registration successful! Please contact support if you need to verify your email.',
          userId: user.id
        });
      }
    } catch (dbError: any) {
      console.error('Registration error:', dbError);
      
      // Handle specific database constraint violations
      if (dbError.code === '23505') {
        if (dbError.constraint === 'users_email_unique') {
          return res.status(400).json({
            success: false,
            message: 'Email already registered'
          });
        }
        if (dbError.constraint === 'users_username_unique') {
          return res.status(400).json({
            success: false,
            message: 'Username already taken'
          });
        }
      }
      
      return res.status(500).json({
        success: false,
        message: 'Registration failed. Please try again.'
      });
    }
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        message: 'Validation error',
        errors: error.errors
      });
    }
    
    console.error('Registration error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to register user'
    });
  }
});



// User login
router.post('/login', async (req: Request, res: Response) => {
  try {
    const { username, password } = req.body;
    
    if (!username || !password) {
      return res.status(400).json({
        success: false,
        message: 'Username and password are required'
      });
    }

    // Find user by username
    const user = await storage.getUserByUsername(username);
    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Invalid username or password'
      });
    }

    // Verify password using bcrypt
    const bcrypt = await import('bcryptjs');
    const isValidPassword = await bcrypt.compare(password, user.password);
    
    if (!isValidPassword) {
      return res.status(401).json({
        success: false,
        message: 'Invalid username or password'
      });
    }

    // Check if email is verified for accounts created with email verification
    if (user.emailVerified === false) {
      return res.status(401).json({
        success: false,
        message: 'Please verify your email address before logging in. Check your email for the verification link.'
      });
    }

    // Set user in session
    (req.session as any).userId = user.id;
    
    return res.status(200).json({
      success: true,
      message: 'Login successful',
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to log in'
    });
  }
});

// Verify 2FA code (simplified - skipping 2FA for now)
router.post('/verify-2fa', async (req: Request, res: Response) => {
  return res.status(200).json({
    success: true,
    message: '2FA verification skipped in development'
  });
});

// User logout
router.post('/logout', (req: Request, res: Response) => {
  req.session.destroy((err) => {
    if (err) {
      return res.status(500).json({
        success: false,
        message: 'Failed to log out'
      });
    }
    
    res.status(200).json({
      success: true,
      message: 'Logged out successfully'
    });
  });
});

// Get current user
router.get('/me', isAuthenticated, async (req: Request, res: Response) => {
  try {
    const userId = req.session.userId;
    const user = await storage.getUser(userId as number);
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }
    
    // Remove password from response
    const { password, ...userWithoutPassword } = user;
    
    res.status(200).json({
      success: true,
      user: userWithoutPassword
    });
  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get user data'
    });
  }
});

// Update user profile
router.patch('/me', isAuthenticated, async (req: Request, res: Response) => {
  try {
    const userId = req.session.userId;
    
    // Only allow updating specific fields
    const updateSchema = z.object({
      firstName: z.string().optional(),
      lastName: z.string().optional(),
      county: z.string().optional(),
      bio: z.string().optional(),
      phoneNumber: z.string()
        .regex(/^\+[1-9]\d{1,14}$/, { message: 'Phone number must be in E.164 format (e.g., +15551234567)' })
        .optional(),
    });
    
    const validatedData = updateSchema.parse(req.body);
    
    // If phone number is provided, check if it's already registered
    if (validatedData.phoneNumber) {
      const existingPhone = await storage.getUserByPhoneNumber(validatedData.phoneNumber);
      if (existingPhone && existingPhone.id !== userId) {
        return res.status(400).json({
          success: false,
          message: 'Phone number already registered to another account'
        });
      }
    }
    
    // Update user
    const updatedUser = await storage.updateUser(userId as number, validatedData);
    
    // If phone number is updated, reset verification status and send verification code
    if (validatedData.phoneNumber) {
      // Generate verification code
      const verificationCode = generateVerificationCode(6);
      const expirationTime = getVerificationExpiration(10); // 10 minutes
      
      // Save verification code in database and mark phone as unverified
      await storage.updateUser(userId as number, { phoneVerified: 0 });
      await storage.setVerificationCode(userId as number, verificationCode, expirationTime);
      
      // Send SMS verification code
      await sendVerificationCode(validatedData.phoneNumber, verificationCode);
    }
    
    // Remove password from response
    const { password, ...userWithoutPassword } = updatedUser;
    
    res.status(200).json({
      success: true,
      message: validatedData.phoneNumber 
        ? 'Profile updated successfully. Please verify your phone number with the code sent via SMS.' 
        : 'Profile updated successfully',
      requiresPhoneVerification: !!validatedData.phoneNumber,
      user: userWithoutPassword
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        message: 'Validation error',
        errors: error.errors
      });
    }
    
    console.error('Update profile error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update profile'
    });
  }
});

// Verify phone number with SMS code
router.post('/verify-phone', isAuthenticated, async (req: Request, res: Response) => {
  try {
    const userId = req.session.userId;
    
    // Validate request body
    const verifySchema = z.object({
      code: z.string().length(6, { message: 'Verification code must be 6 digits' })
    });
    
    const { code } = verifySchema.parse(req.body);
    
    // Get user
    const user = await storage.getUser(userId as number);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }
    
    // Verify the code
    const isVerified = await storage.verifyUserPhone(userId as number, code);
    
    if (isVerified) {
      return res.status(200).json({
        success: true,
        message: 'Phone number verified successfully'
      });
    } else {
      return res.status(400).json({
        success: false,
        message: 'Invalid or expired verification code'
      });
    }
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        message: 'Validation error',
        errors: error.errors
      });
    }
    
    console.error('Phone verification error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to verify phone number'
    });
  }
});

// Resend verification code
router.post('/resend-verification', isAuthenticated, async (req: Request, res: Response) => {
  try {
    const userId = req.session.userId;
    
    // Get user
    const user = await storage.getUser(userId as number);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }
    
    // Check if user has a phone number
    if (!user.phoneNumber) {
      return res.status(400).json({
        success: false,
        message: 'No phone number associated with this account'
      });
    }
    
    // Generate new verification code
    const verificationCode = generateVerificationCode(6);
    const expirationTime = getVerificationExpiration(10); // 10 minutes
    
    // Save verification code in database
    await storage.setVerificationCode(userId as number, verificationCode, expirationTime);
    
    // Send SMS verification code
    const sendResult = await sendVerificationCode(user.phoneNumber, verificationCode);
    
    if (sendResult.success) {
      return res.status(200).json({
        success: true,
        message: 'Verification code sent successfully'
      });
    } else {
      return res.status(500).json({
        success: false,
        message: 'Failed to send verification code',
        error: sendResult.message
      });
    }
  } catch (error) {
    console.error('Resend verification error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to resend verification code'
    });
  }
});

// Profile image upload endpoint
router.post('/upload-profile-image', isAuthenticated, upload.single('profileImage'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'No image file provided'
      });
    }

    const userId = req.session?.userId;
    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'User not authenticated'
      });
    }

    // Generate the URL for the uploaded image
    const imageUrl = `/uploads/${req.file.filename}`;

    // Update user's profile image URL in database
    await storage.updateUser(userId, { profileImageUrl: imageUrl });

    res.status(200).json({
      success: true,
      message: 'Profile image uploaded successfully',
      imageUrl: imageUrl
    });

  } catch (error) {
    console.error('Profile image upload error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to upload profile image'
    });
  }
});

// Email verification endpoint
router.get('/verify-email', async (req: Request, res: Response) => {
  try {
    const { token } = req.query;

    if (!token || typeof token !== 'string') {
      return res.status(400).json({
        success: false,
        message: 'Invalid verification token'
      });
    }

    // Find the verification token in the database
    const verificationRecord = await storage.getEmailVerificationToken(token);
    
    if (!verificationRecord) {
      return res.status(400).json({
        success: false,
        message: 'Invalid or expired verification token'
      });
    }

    // Check if token is expired (24 hours)
    const now = new Date();
    const tokenAge = now.getTime() - verificationRecord.createdAt.getTime();
    const maxAge = 24 * 60 * 60 * 1000; // 24 hours

    if (tokenAge > maxAge) {
      await storage.deleteEmailVerificationToken(token);
      return res.status(400).json({
        success: false,
        message: 'Verification token has expired. Please request a new one.'
      });
    }

    // Update user's email verification status
    await storage.updateUser(verificationRecord.userId, { emailVerified: true });
    
    // Delete the used token
    await storage.deleteEmailVerificationToken(token);

    // Return success page or redirect
    res.send(`
      <html>
        <head>
          <title>Email Verified - Glas Politics</title>
          <style>
            body { font-family: Arial, sans-serif; text-align: center; padding: 50px; }
            .success { color: #22c55e; }
            .button { background: #3b82f6; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block; margin-top: 20px; }
          </style>
        </head>
        <body>
          <h1 class="success">✓ Email Verified Successfully!</h1>
          <p>Your Glas Politics account has been verified. You can now log in.</p>
          <a href="/" class="button">Continue to Glas Politics</a>
        </body>
      </html>
    `);

  } catch (error) {
    console.error('Email verification error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to verify email'
    });
  }
});

export default router;