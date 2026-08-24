import { IOtpProvider, OtpVerificationResult } from "./otp.provider.interface";
import { logger } from "@/config/logger";

export class Msg91OtpProvider implements IOtpProvider {
    public name = "msg91";

    /**
     * Formats mobile number to MSG91 required format (e.g. 919876543210 or 15597455839 without '+')
     */
    private formatMobile(phoneNumber: string): string {
        let cleaned = phoneNumber.replace(/[^\d]/g, "");
        if (cleaned.length === 10) {
            cleaned = `91${cleaned}`;
        }
        return cleaned;
    }

    /**
     * Triggers OTP SMS via MSG91 v5 OTP API
     */
    public async sendOtp(phoneNumber: string) {
        const authKey = process.env.MSG91_AUTH_KEY || "";
        const templateId = process.env.MSG91_TEMPLATE_ID || "";
        const mobile = this.formatMobile(phoneNumber);

        if (!authKey) {
            logger.error("MSG91_AUTH_KEY is not configured in environment variables");
            throw new Error("MSG91 OTP service configuration missing (MSG91_AUTH_KEY)");
        }

        try {
            let url = `https://control.msg91.com/api/v5/otp?mobile=${encodeURIComponent(mobile)}`;
            if (templateId) {
                url += `&template_id=${encodeURIComponent(templateId)}`;
            }

            logger.info(`[MSG91] Sending OTP SMS to ${mobile}...`);

            const response = await fetch(url, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "authkey": authKey,
                },
                body: JSON.stringify({
                    otp_expiry: 5,
                }),
            });

            const data = (await response.json()) as any;
            logger.info(`[MSG91] Send OTP response for ${mobile}:`, data);

            if (!response.ok || data?.type === "error" || data?.status === "error") {
                logger.error(`[MSG91] Send OTP failed: ${data?.message || JSON.stringify(data)}`);
                throw new Error(data?.message || "Failed to send OTP via MSG91");
            }

            return { status: "pending", expiresIn: 300 };
        } catch (error: any) {
            logger.error("Error in MSG91 sendOtp:", error);
            throw error;
        }
    }

    /**
     * Verifies OTP code or Access Token via MSG91 APIs
     */
    public async verifyOtp(phoneNumber: string, tokenOrCode: string): Promise<OtpVerificationResult> {
        const authKey = process.env.MSG91_AUTH_KEY || "";
        const mobile = this.formatMobile(phoneNumber);

        if (!authKey) {
            return { success: false, reason: "MSG91 Auth Key not configured" };
        }

        const trimmedInput = tokenOrCode.trim();

        // 1. Direct OTP Code Verification (4 to 6 digit numeric code)
        if (/^\d{4,6}$/.test(trimmedInput)) {
            try {
                const url = `https://control.msg91.com/api/v5/otp/verify?mobile=${encodeURIComponent(mobile)}&otp=${encodeURIComponent(trimmedInput)}`;
                
                const response = await fetch(url, {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        "authkey": authKey,
                    },
                });

                const data = (await response.json()) as any;
                logger.info(`[MSG91] Verify OTP response for ${mobile}:`, data);

                if (
                    response.ok &&
                    (data?.type === "success" ||
                     data?.status === "success" ||
                     data?.message?.toLowerCase().includes("success") ||
                     data?.message?.toLowerCase().includes("verified"))
                ) {
                    return { success: true, mobile };
                }

                logger.warn(`[MSG91] Direct OTP verification failed: ${data?.message || "Invalid OTP"}`);
                return { success: false, reason: data?.message || "Invalid or expired OTP" };
            } catch (error: any) {
                logger.error("Error in MSG91 verifyOtp direct code:", error);
                return { success: false, reason: error.message || "OTP verification request failed" };
            }
        }

        // 2. MSG91 Widget Access Token Verification
        try {
            const url = "https://control.msg91.com/api/v5/widget/verifyAccessToken";

            const response = await fetch(url, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Accept": "application/json",
                },
                body: JSON.stringify({
                    authkey: authKey,
                    "access-token": trimmedInput,
                }),
            });

            const data = (await response.json()) as any;

            if (!response.ok || data?.type === "error" || data?.status === "error") {
                logger.warn(`[MSG91] Token verification failed: ${data?.message || "Invalid token"}`);
                return { success: false, reason: data?.message || "MSG91 token verification failed" };
            }

            const verifiedMobile = data?.mobile || data?.number || data?.phone;

            if (
                verifiedMobile &&
                !phoneNumber.includes(verifiedMobile) &&
                !verifiedMobile.includes(phoneNumber.replace("+", ""))
            ) {
                logger.warn(`[MSG91] Mobile mismatch: expected ${phoneNumber}, got ${verifiedMobile}`);
                return { success: false, reason: "Verified mobile number mismatch" };
            }

            return { success: true, mobile: verifiedMobile || phoneNumber };
        } catch (error: any) {
            logger.error("Error verifying MSG91 access token:", error);
            return { success: false, reason: error.message || "MSG91 API request failed" };
        }
    }
}
