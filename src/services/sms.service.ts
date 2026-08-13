import twilio from "twilio";
import envVars from "@/config/envVars";
import { logger } from "@/config/logger";
import { redis } from "@/config/redis";

const twilioClient = twilio(envVars.TWILIO_ACCOUNT_SID, envVars.TWILIO_AUTH_TOKEN);

class SmsService {
    public async sendOtp(phoneNumber: string) {
        try {
            const cooldownKey = `otp:cooldown:${phoneNumber}`;
            const onCooldown = await redis.getValue(cooldownKey);
            if (onCooldown) {
                throw new Error("Please wait 1 minute before requesting another OTP");
            }

            // --- TEST NUMBER BYPASS ---
            if (phoneNumber === "0000000000") {
                await redis.setValue(`otp:0000000000`, "123456", 5 * 60);
                logger.info("[MOCK SMS] OTP for 0000000000 is 123456");
                return { expiresIn: 5 * 60, status: "pending" };
            }

            const e164 = phoneNumber.startsWith("+") ? phoneNumber : `+91${phoneNumber}`;

            const verification = await twilioClient.verify.v2.services(envVars.TWILIO_VERIFY_SERVICE_SID)
                .verifications
                .create({ to: e164, channel: 'sms' });

            await redis.setValue(cooldownKey, "1", 60);

            return { expiresIn: 5 * 60, status: verification.status };

        } catch (error: any) {
            logger.error(`Error sending OTP to ${phoneNumber}:`, error);
            throw new Error(error.message || "Failed to send OTP via Twilio");
        }
    }

    public async verifyOtp(phoneNumber: string, code: string) {
        try {
            // --- TEST NUMBER BYPASS ---
            if (phoneNumber === "0000000000") {
                const stored = await redis.getValue(`otp:0000000000`);
                if (stored === code) {
                    await redis.deleteValue(`otp:0000000000`);
                    return { success: true };
                }
                return { success: false, reason: "Incorrect OTP" };
            }
            // --------------------------

            const e164 = phoneNumber.startsWith("+") ? phoneNumber : `+91${phoneNumber}`;
            const verificationCheck = await twilioClient.verify.v2.services(envVars.TWILIO_VERIFY_SERVICE_SID)
                .verificationChecks
                .create({ to: e164, code });

            if (verificationCheck.status === "approved") {
                return { success: true };
            } else {
                return { success: false, reason: "Incorrect or expired OTP" };
            }
        } catch (error) {
            logger.error(`Error verifying OTP for ${phoneNumber}:`, error);
            return { success: false, reason: "Error verifying OTP" };
        }
    }
}

export const smsService = new SmsService();