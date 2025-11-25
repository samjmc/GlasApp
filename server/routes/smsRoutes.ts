import { Router, Request, Response } from 'express';
import { sendSMS, isTwilioConfigured, SendSMSOptions } from '../services/twilioService';
import { z } from 'zod';
import { isAuthenticated } from '../middleware/sessionMiddleware';

const router = Router();

// SMS validation schema
const sendSMSSchema = z.object({
  phoneNumber: z.string()
    .regex(/^\+[1-9]\d{1,14}$/, 'Phone number must be in E.164 format (e.g., +15551234567)'),
  message: z.string()
    .min(1, 'Message cannot be empty')
    .max(1600, 'Message cannot exceed 1600 characters'),
  mediaUrl: z.string().url().optional()
});

// Send SMS endpoint (authenticated)
router.post('/send', isAuthenticated, async (req: Request, res: Response) => {
  try {
    // Check if Twilio is configured
    if (!isTwilioConfigured()) {
      return res.status(503).json({
        success: false,
        message: 'SMS service is not currently available. Please contact the administrator.'
      });
    }

    // Validate request body
    const validationResult = sendSMSSchema.safeParse(req.body);
    if (!validationResult.success) {
      return res.status(400).json({
        success: false,
        message: 'Validation error',
        errors: validationResult.error.errors
      });
    }

    const { phoneNumber, message, mediaUrl } = validationResult.data;
    
    // Prepare SMS options
    const smsOptions: SendSMSOptions = {
      to: phoneNumber,
      body: message
    };
    
    // Add media URL if provided
    if (mediaUrl) {
      smsOptions.mediaUrl = mediaUrl;
    }

    // Send the SMS
    const result = await sendSMS(smsOptions);
    
    if (result.success) {
      return res.status(200).json(result);
    } else {
      return res.status(500).json(result);
    }
  } catch (error) {
    console.error('Error in /sms/send endpoint:', error);
    return res.status(500).json({
      success: false,
      message: 'An unexpected error occurred',
      error: process.env.NODE_ENV === 'development' ? error : undefined
    });
  }
});

// Check SMS service status endpoint
router.get('/status', async (_req: Request, res: Response) => {
  const isConfigured = isTwilioConfigured();
  return res.status(200).json({
    available: isConfigured,
    message: isConfigured 
      ? 'SMS service is available' 
      : 'SMS service is not configured'
  });
});

// Test endpoint (FOR DEVELOPMENT ONLY - remove in production)
router.get('/test', async (_req: Request, res: Response) => {
  try {
    // Check if Twilio is configured
    if (!isTwilioConfigured()) {
      return res.status(503).json({
        success: false,
        message: 'SMS service is not currently available. Please check your Twilio credentials.'
      });
    }
    
    return res.status(200).json({
      success: true,
      message: 'SMS service is properly configured and ready to use.',
      // Don't expose actual credentials, just confirm they exist
      accountConfigured: !!process.env.TWILIO_ACCOUNT_SID,
      tokenConfigured: !!process.env.TWILIO_AUTH_TOKEN,
      phoneConfigured: !!process.env.TWILIO_PHONE_NUMBER,
    });
    
  } catch (error) {
    console.error('Error in /sms/test endpoint:', error);
    return res.status(500).json({
      success: false,
      message: 'An error occurred while testing the SMS service',
      error: process.env.NODE_ENV === 'development' ? error : undefined
    });
  }
});

export default router;