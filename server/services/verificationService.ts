import { sendSMS } from './twilioService';

/**
 * Generates a random verification code of specified length
 * 
 * @param length Length of the verification code (default: 6)
 * @returns A numeric verification code as string
 */
export function generateVerificationCode(length = 6): string {
  const characters = '0123456789';
  let code = '';
  
  for (let i = 0; i < length; i++) {
    const randomIndex = Math.floor(Math.random() * characters.length);
    code += characters[randomIndex];
  }
  
  return code;
}

/**
 * Returns the expiration time for verification codes
 * 
 * @param minutes Minutes until expiration (default: 10)
 * @returns Date object representing the expiration time
 */
export function getVerificationExpiration(minutes = 10): Date {
  const expirationDate = new Date();
  expirationDate.setMinutes(expirationDate.getMinutes() + minutes);
  return expirationDate;
}

/**
 * Sends a verification code to the specified phone number
 * 
 * @param phoneNumber The phone number to send the verification code to (E.164 format)
 * @param code The verification code to send
 * @returns Object indicating success/failure of the operation
 */
export async function sendVerificationCode(phoneNumber: string, code: string): Promise<{success: boolean, message: string}> {
  try {
    // Ensure phone number is in E.164 format
    if (!phoneNumber.match(/^\+[1-9]\d{1,14}$/)) {
      return {
        success: false,
        message: "Invalid phone number format. Must be in E.164 format (e.g., +15551234567)"
      };
    }
    
    const message = `Your Glas Politics verification code is: ${code}. This code will expire in 10 minutes.`;
    
    const result = await sendSMS({
      to: phoneNumber,
      body: message
    });
    
    return {
      success: result.success,
      message: result.success ? "Verification code sent successfully" : result.message
    };
  } catch (error) {
    console.error("Error sending verification code:", error);
    return {
      success: false,
      message: "Failed to send verification code"
    };
  }
}

/**
 * Validates if the provided verification code matches and hasn't expired
 * 
 * @param storedCode The code stored in the database
 * @param providedCode The code provided by the user
 * @param expirationTime The expiration time of the code
 * @returns Boolean indicating if the code is valid
 */
export function validateVerificationCode(
  storedCode: string | null | undefined,
  providedCode: string,
  expirationTime: Date | null | undefined
): boolean {
  // Check if codes match
  if (!storedCode || storedCode !== providedCode) {
    return false;
  }
  
  // Check if code has expired
  if (!expirationTime || new Date() > expirationTime) {
    return false;
  }
  
  return true;
}