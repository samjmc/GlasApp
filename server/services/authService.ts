import bcrypt from 'bcryptjs';
import { storage } from '../storage';
import { InsertUser } from '@shared/schema';
import { EmailService } from './emailService';
import { TokenService } from './tokenService';

const SALT_ROUNDS = 10;

/**
 * Authentication service for user management
 */
export const authService = {
  /**
   * Register a new user with email verification
   */
  async register(userData: Omit<InsertUser, 'password'> & { password: string }): Promise<{ success: boolean; message: string; userId?: number; requiresVerification?: boolean }> {
    try {
      // Check if username already exists
      const existingUsername = await storage.getUserByUsername(userData.username);
      if (existingUsername) {
        return { success: false, message: 'Username already taken' };
      }
      
      // Check if email already exists
      const existingEmail = await storage.getUserByEmail(userData.email);
      if (existingEmail) {
        return { success: false, message: 'Email already registered' };
      }
      
      // Hash password
      const hashedPassword = await bcrypt.hash(userData.password, SALT_ROUNDS);
      
      // Create user (email not verified initially)
      const user = await storage.createUser({
        ...userData,
        password: hashedPassword,
        emailVerified: false,
        twoFactorEnabled: true, // Enable 2FA by default for security
      });
      
      // Generate email verification token
      const verificationToken = TokenService.generateVerificationToken();
      const expiresAt = TokenService.getExpirationTime(24 * 60); // 24 hours
      
      await storage.createEmailVerificationToken({
        userId: user.id,
        token: verificationToken,
        expiresAt,
      });
      
      // Send verification email
      const emailResult = await EmailService.sendVerificationEmail(
        user.email,
        verificationToken,
        user.firstName || undefined
      );
      
      if (!emailResult.success) {
        console.error('Failed to send verification email:', emailResult.error);
        return { 
          success: false, 
          message: 'Registration successful but verification email failed to send. Please contact support.' 
        };
      }
      
      return { 
        success: true, 
        message: 'Registration successful! Please check your email to verify your account.',
        userId: user.id,
        requiresVerification: true
      };
    } catch (error) {
      console.error('Registration error:', error);
      return { success: false, message: 'Error registering user' };
    }
  },

  /**
   * Verify email address with token
   */
  async verifyEmail(token: string): Promise<{ success: boolean; message: string }> {
    try {
      // Find verification token
      const verificationToken = await storage.getEmailVerificationToken(token);
      if (!verificationToken) {
        return { success: false, message: 'Invalid or expired verification token' };
      }
      
      // Check if token has expired
      if (TokenService.isExpired(verificationToken.expiresAt)) {
        await storage.deleteEmailVerificationToken(token);
        return { success: false, message: 'Verification token has expired' };
      }
      
      // Update user as verified
      await storage.updateUser(verificationToken.userId, {
        emailVerified: true,
      });
      
      // Delete the used token
      await storage.deleteEmailVerificationToken(token);
      
      return { 
        success: true, 
        message: 'Email verified successfully! You can now log in.' 
      };
    } catch (error) {
      console.error('Email verification error:', error);
      return { success: false, message: 'Error verifying email' };
    }
  },
  
  /**
   * Authenticate a user with 2FA support
   */
  async login(username: string, password: string): Promise<{ success: boolean; message: string; userId?: number; requires2FA?: boolean }> {
    try {
      // Find user by username
      const user = await storage.getUserByUsername(username);
      if (!user) {
        return { success: false, message: 'Invalid username or password' };
      }

      // Check if email is verified
      if (!user.emailVerified) {
        return { success: false, message: 'Please verify your email before logging in' };
      }

      // Check password
      const isValidPassword = await bcrypt.compare(password, user.password);
      if (!isValidPassword) {
        return { success: false, message: 'Invalid username or password' };
      }

      // If 2FA is enabled, send verification code
      if (user.twoFactorEnabled) {
        const twoFactorCode = TokenService.generate2FACode();
        const expiresAt = TokenService.getExpirationTime(10); // 10 minutes

        await storage.create2FAToken({
          userId: user.id,
          token: twoFactorCode,
          type: 'login',
          expiresAt,
          used: false,
        });

        // Send 2FA code via email
        const emailResult = await EmailService.send2FACode(
          user.email,
          twoFactorCode,
          user.firstName || undefined
        );

        if (!emailResult.success) {
          console.error('Failed to send 2FA code:', emailResult.error);
          return { success: false, message: 'Failed to send verification code' };
        }

        return {
          success: true,
          message: 'Verification code sent to your email',
          userId: user.id,
          requires2FA: true,
        };
      }

      return { 
        success: true, 
        message: 'Login successful', 
        userId: user.id 
      };
    } catch (error) {
      console.error('Login error:', error);
      return { success: false, message: 'Error during login' };
    }
  },

  /**
   * Verify 2FA code during login
   */
  async verify2FA(userId: number, code: string): Promise<{ success: boolean; message: string }> {
    try {
      // Find the 2FA token
      const twoFactorToken = await storage.get2FAToken(userId, code, 'login');
      if (!twoFactorToken) {
        return { success: false, message: 'Invalid or expired verification code' };
      }

      // Check if token has expired
      if (TokenService.isExpired(twoFactorToken.expiresAt)) {
        return { success: false, message: 'Verification code has expired' };
      }

      // Mark token as used
      await storage.mark2FATokenAsUsed(twoFactorToken.id);

      return { 
        success: true, 
        message: 'Login successful' 
      };
    } catch (error) {
      console.error('2FA verification error:', error);
      return { success: false, message: 'Error verifying code' };
    }
  },
  
  /**
   * Update user profile
   */
  async updateProfile(
    userId: number, 
    updates: Partial<InsertUser>
  ): Promise<{ success: boolean; message: string }> {
    try {
      // If updating password, hash it first
      if (updates.password) {
        updates.password = await bcrypt.hash(updates.password, SALT_ROUNDS);
      }
      
      // If updating email or username, check if they're already taken
      if (updates.email) {
        const existingEmail = await storage.getUserByEmail(updates.email);
        if (existingEmail && existingEmail.id !== userId) {
          return { success: false, message: 'Email already registered' };
        }
      }
      
      if (updates.username) {
        const existingUsername = await storage.getUserByUsername(updates.username);
        if (existingUsername && existingUsername.id !== userId) {
          return { success: false, message: 'Username already taken' };
        }
      }
      
      await storage.updateUser(userId, updates);
      return { success: true, message: 'Profile updated successfully' };
    } catch (error) {
      console.error('Profile update error:', error);
      return { success: false, message: 'Error updating profile' };
    }
  }
};