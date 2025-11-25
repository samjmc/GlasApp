import crypto from 'crypto';

export class TokenService {
  /**
   * Generate a secure random token for email verification
   */
  static generateVerificationToken(): string {
    return crypto.randomBytes(32).toString('hex');
  }

  /**
   * Generate a 6-digit OTP code for 2FA
   */
  static generate2FACode(): string {
    return Math.floor(100000 + Math.random() * 900000).toString();
  }

  /**
   * Calculate expiration time for tokens
   */
  static getExpirationTime(minutes: number): Date {
    return new Date(Date.now() + minutes * 60 * 1000);
  }

  /**
   * Check if a token has expired
   */
  static isExpired(expirationDate: Date): boolean {
    return new Date() > expirationDate;
  }
}