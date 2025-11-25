import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

export interface EmailOptions {
  to: string;
  subject: string;
  html: string;
  from?: string;
}

export class EmailService {
  private static readonly FROM_EMAIL = 'noreply@glasspolitics.ie';

  static async sendEmail(options: EmailOptions): Promise<{ success: boolean; messageId?: string; error?: string }> {
    try {
      if (!process.env.RESEND_API_KEY) {
        throw new Error('RESEND_API_KEY is not configured');
      }

      const { data, error } = await resend.emails.send({
        from: options.from || this.FROM_EMAIL,
        to: options.to,
        subject: options.subject,
        html: options.html,
      });

      if (error) {
        console.error('Email sending failed:', error);
        return { success: false, error: error.message };
      }

      return { success: true, messageId: data?.id };
    } catch (error) {
      console.error('Email service error:', error);
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }

  static async sendVerificationEmail(email: string, token: string, firstName?: string): Promise<{ success: boolean; error?: string }> {
    const verificationUrl = `${process.env.CLIENT_URL || 'http://localhost:5000'}/verify-email?token=${token}`;
    
    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <title>Verify Your Email - Glas Politics</title>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: #018401; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
            .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 8px 8px; }
            .button { display: inline-block; background: #018401; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; margin: 20px 0; }
            .footer { margin-top: 20px; padding-top: 20px; border-top: 1px solid #ddd; font-size: 12px; color: #666; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>Welcome to Glas Politics!</h1>
            </div>
            <div class="content">
              <h2>Verify Your Email Address</h2>
              <p>Hello ${firstName || 'there'},</p>
              <p>Thank you for registering with Glas Politics! To complete your registration and start exploring Irish political insights, please verify your email address by clicking the button below:</p>
              
              <p style="text-align: center;">
                <a href="${verificationUrl}" class="button">Verify Email Address</a>
              </p>
              
              <p>Or copy and paste this link into your browser:</p>
              <p style="word-break: break-all; background: #eee; padding: 10px; border-radius: 4px;">${verificationUrl}</p>
              
              <p>This verification link will expire in 24 hours for security reasons.</p>
              
              <p>If you didn't create an account with Glas Politics, please ignore this email.</p>
            </div>
            <div class="footer">
              <p>© 2024 Glas Politics. All rights reserved.</p>
              <p>This is an automated message. Please do not reply to this email.</p>
            </div>
          </div>
        </body>
      </html>
    `;

    const result = await this.sendEmail({
      to: email,
      subject: 'Verify your email address - Glas Politics',
      html
    });

    return result;
  }

  static async send2FACode(email: string, code: string, firstName?: string): Promise<{ success: boolean; error?: string }> {
    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <title>Your Login Code - Glas Politics</title>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: #018401; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
            .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 8px 8px; }
            .code { font-size: 32px; font-weight: bold; text-align: center; background: white; padding: 20px; border-radius: 8px; letter-spacing: 5px; margin: 20px 0; border: 2px solid #018401; }
            .footer { margin-top: 20px; padding-top: 20px; border-top: 1px solid #ddd; font-size: 12px; color: #666; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>Glas Politics</h1>
            </div>
            <div class="content">
              <h2>Your Login Verification Code</h2>
              <p>Hello ${firstName || 'there'},</p>
              <p>Use the following 6-digit code to complete your login:</p>
              
              <div class="code">${code}</div>
              
              <p>This code will expire in 10 minutes for security reasons.</p>
              
              <p>If you didn't attempt to log in, please ignore this email and consider changing your password.</p>
            </div>
            <div class="footer">
              <p>© 2024 Glas Politics. All rights reserved.</p>
              <p>This is an automated message. Please do not reply to this email.</p>
            </div>
          </div>
        </body>
      </html>
    `;

    const result = await this.sendEmail({
      to: email,
      subject: 'Your login verification code - Glas Politics',
      html
    });

    return result;
  }
}