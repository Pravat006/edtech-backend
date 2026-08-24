import { IOtpProvider, OtpVerificationResult } from "./otp.provider.interface";
import { logger } from "@/config/logger";

export class MockOtpProvider implements IOtpProvider {
    public name = "mock";

    public async sendOtp(phoneNumber: string) {
        logger.info(`[Mock OTP Provider] Sent test OTP to ${phoneNumber}. Any 4-digit OTP will be accepted.`);
        return { status: "pending", expiresIn: 300 };
    }

    public async verifyOtp(phoneNumber: string, tokenOrCode: string): Promise<OtpVerificationResult> {
        const trimmed = tokenOrCode.trim();
        logger.info(`[Mock OTP Provider] Verifying code '${trimmed}' for ${phoneNumber}`);

        // Accept ANY non-empty code in mock mode
        if (trimmed.length > 0) {
            return { success: true, mobile: phoneNumber };
        }

        return { success: false, reason: "OTP code cannot be empty" };
    }
}
