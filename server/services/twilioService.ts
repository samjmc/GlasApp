import twilio from 'twilio';

// Initialize Twilio client with credentials from environment variables
const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const fromNumber = process.env.TWILIO_PHONE_NUMBER;

// Create Twilio client
const client = accountSid && authToken ? twilio(accountSid, authToken) : null;

export interface SendSMSOptions {
  to: string;         // Recipient phone number (E.164 format)
  body: string;       // Message content
  mediaUrl?: string;  // Optional URL to an image to send with the message
}

export interface SMSResponse {
  success: boolean;
  sid?: string;       // Message SID if successful
  message: string;    // Success or error message
  error?: any;        // Error details if unsuccessful
}

/**
 * Sends an SMS message using Twilio
 * 
 * @param options SendSMSOptions object with recipient and message details
 * @returns Promise with the result of the SMS sending operation
 */
export async function sendSMS(options: SendSMSOptions): Promise<SMSResponse> {
  // Validate environment variables
  if (!client || !fromNumber) {
    return {
      success: false,
      message: "Twilio credentials not properly configured",
    };
  }
  
  // Validate phone number format (basic E.164 validation)
  if (!options.to.match(/^\+[1-9]\d{1,14}$/)) {
    return {
      success: false,
      message: "Invalid phone number format. Must be in E.164 format (e.g., +15551234567)",
    };
  }
  
  try {
    const messageOptions: any = {
      to: options.to,
      from: fromNumber,
      body: options.body,
    };
    
    // Add media URL if provided
    if (options.mediaUrl) {
      messageOptions.mediaUrl = [options.mediaUrl];
    }
    
    // Send the message
    const message = await client.messages.create(messageOptions);
    
    return {
      success: true,
      sid: message.sid,
      message: "SMS sent successfully",
    };
  } catch (error) {
    console.error("Error sending SMS:", error);
    return {
      success: false,
      message: "Failed to send SMS",
      error: error,
    };
  }
}

/**
 * Check if Twilio service is properly configured
 * 
 * @returns Boolean indicating if Twilio is configured
 */
export function isTwilioConfigured(): boolean {
  return !!(client && fromNumber);
}