// import twilio from "twilio";
// import envVars from "@/config/envVars";
import { logger } from "@/config/logger";
import { redis } from "@/config/redis";

// const twilioClient = twilio(envVars.TWILIO_ACCOUNT_SID, envVars.TWILIO_AUTH_TOKEN);

class SmsService {
    public async sendOtp(phoneNumber: string) {
        try {
            const cooldownKey = `otp:cooldown:${phoneNumber}`;
            const onCooldown = await redis.getValue(cooldownKey);
            if (onCooldown) {
                throw new Error("Please wait 1 minute before requesting another OTP");
            }

            // --- DEV BYPASS: NO TWILIO ---
            // For development/MVP without SMS service, we hardcode OTP to 1234
            const mockOtp = "1234";
            const e164 = phoneNumber.startsWith("+") ? phoneNumber : `+91${phoneNumber}`;
            
            // Store the mock OTP in Redis for 5 minutes
            await redis.setValue(`otp:${e164}`, mockOtp, 5 * 60);
            await redis.setValue(cooldownKey, "1", 60);

            logger.info(`[MOCK SMS] OTP for ${e164} is ${mockOtp}`);
            return { expiresIn: 5 * 60, status: "pending" };
            
        } catch (error: any) {
            logger.error(`Error sending OTP to ${phoneNumber}:`, error);
            throw new Error(error.message || "Failed to send OTP");
        }
    }

    public async verifyOtp(phoneNumber: string, code: string) {
        try {
            const e164 = phoneNumber.startsWith("+") ? phoneNumber : `+91${phoneNumber}`;
            
            // --- DEV BYPASS: NO TWILIO ---
            const storedOtp = await redis.getValue(`otp:${e164}`);
            
            if (storedOtp && storedOtp === code) {
                // OTP matches! Delete it so it can't be reused
                await redis.deleteValue(`otp:${e164}`);
                return { success: true };
            } else {
                return { success: false, reason: "Invalid or expired OTP" };
            }
        } catch (error) {
            logger.error(`Error verifying OTP for ${phoneNumber}:`, error);
            return { success: false, reason: "Internal verification error" };
        }
    }
}

export const smsService = new SmsService();