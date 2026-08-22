import { db } from "@/config/database";
import httpStatus from "http-status";
import { APIError } from "@/utils/APIError";
import { UpdateProfile, UpdatePreferences } from "./user.schema";
import { cleanupOldMediaAsset } from "@/services/imagekit.service";

class UserService {
    public async getProfile(userId: string) {
        const user = await db.user.findUnique({
            where: { id: userId },
            include: {
                referralCode: true,
                wallet: true,
                avatar: true,
                preferences: true,
                address: true,
                personalDetails: {
                    include: {
                        aadhaarFile: { select: { url: true } },
                        panFile: { select: { url: true } },
                        signatureImage: { select: { url: true } },
                    }
                },
                educationDetails: {
                    include: {
                        collegeResultFile: { select: { url: true } },
                        classXIIResultFile: { select: { url: true } },
                        classXResultFile: { select: { url: true } },
                    }
                }
            }
        });
        if (!user) throw new APIError(httpStatus.NOT_FOUND, "User not found");

        // Hide sensitive fields before returning
        const { ...safeUser } = user;
        return safeUser;
    }

    public async updateProfile(userId: string, data: UpdateProfile) {
        if (data.avatarMediaId) {
            const currentUser = await db.user.findUnique({
                where: { id: userId },
                select: { avatarMediaId: true }
            });
            cleanupOldMediaAsset(currentUser?.avatarMediaId, data.avatarMediaId);
        }

        return await db.user.update({
            where: { id: userId },
            data,
            include: { avatar: true }
        });
    }

    public async getPreferences(userId: string) {
        return await db.userPreferences.findUnique({
            where: { userId }
        });
    }

    public async updatePreferences(userId: string, data: UpdatePreferences) {

        const subjects = (data.subjects ?? []) as unknown[];
        const goals = (data.goals ?? []) as unknown[];

        return await db.userPreferences.upsert({
            where: { userId },
            update: { language: data.language, subjects: subjects as any, goals: goals as any },

            create: { userId, language: data.language || "en", subjects: subjects as any, goals: goals as any },
        });
    }

    public async getWallet(userId: string) {
        const wallet = await db.wallet.findUnique({
            where: { userId }
        });
        const transactions = await db.transaction.findMany({
            where: { userId }
        });
        return { wallet, transactions };
    }

    public async getReferrals(userId: string) {
        return await db.referral.findMany({
            where: { referrerId: userId },
            include: { referee: { select: { name: true, phoneNumber: true } } }
        });
    }

    public async updatePushToken(userId: string, token: string) {
        return await db.user.update({
            where: { id: userId },
            data: { expoPushToken: token },
            select: { id: true, expoPushToken: true },
        });
    }

    /**
     * Step 1: Request Phone Number Change (Sends SMS OTP)
     */
    public async requestPhoneChange(userId: string, newPhoneNumber: string) {
        const e164 = newPhoneNumber.startsWith("+") ? newPhoneNumber : `+91${newPhoneNumber.trim()}`;

        // Check if phone number is already registered to another user
        const existingUser = await db.user.findUnique({
            where: { phoneNumber: e164 },
        });

        if (existingUser && existingUser.id !== userId) {
            throw new APIError(httpStatus.BAD_REQUEST, "This phone number is already registered to another account.");
        }

        const { smsService } = await import("@/services/sms.service");
        await smsService.sendOtp(e164);

        return {
            success: true,
            message: `OTP sent successfully to ${e164}`,
            phoneNumber: e164,
        };
    }

    /**
     * Step 2: Verify Phone Number Change via SMS OTP
     */
    public async verifyPhoneChange(userId: string, newPhoneNumber: string, code: string) {
        const e164 = newPhoneNumber.startsWith("+") ? newPhoneNumber : `+91${newPhoneNumber.trim()}`;

        const { smsService } = await import("@/services/sms.service");
        const verification = await smsService.verifyOtp(e164, code);

        if (!verification.success) {
            throw new APIError(httpStatus.BAD_REQUEST, verification.reason || "Invalid or expired OTP code.");
        }

        // Check again for concurrency safety
        const existingUser = await db.user.findUnique({
            where: { phoneNumber: e164 },
        });

        if (existingUser && existingUser.id !== userId) {
            throw new APIError(httpStatus.BAD_REQUEST, "This phone number is already registered to another account.");
        }

        const updatedUser = await db.user.update({
            where: { id: userId },
            data: { phoneNumber: e164 },
        });

        return {
            success: true,
            message: "Phone number updated successfully.",
            user: updatedUser,
        };
    }

    /**
     * Step 1: Request Email Change/Verification (Sends 6-digit Email OTP)
     */
    public async requestEmailChange(userId: string, newEmail: string) {
        const cleanEmail = newEmail.toLowerCase().trim();

        const existingUser = await db.user.findUnique({
            where: { email: cleanEmail },
        });

        if (existingUser && existingUser.id !== userId) {
            throw new APIError(httpStatus.BAD_REQUEST, "This email address is already registered to another account.");
        }

        const user = await db.user.findUnique({
            where: { id: userId },
            select: { name: true },
        });

        // Generate 6-digit OTP
        const otpCode = Math.floor(100000 + Math.random() * 900000).toString();

        const { logger } = await import("@/config/logger");
        logger.info(`[Email OTP] Generated verification code for user ${userId} (${cleanEmail}): ${otpCode}`);

        const { redis } = await import("@/config/redis");
        const redisKey = `change-email:otp:${userId}`;
        
        // Store payload in Redis for 5 minutes
        await redis.setValue(redisKey, JSON.stringify({ email: cleanEmail, code: otpCode }), 5 * 60);

        const { emailService } = await import("@/modules/email/email.service");
        const sent = await emailService.sendEmailVerificationOtp({
            to: cleanEmail,
            name: user?.name || "Learner",
            otpCode,
        });

        if (!sent) {
            logger.error(`[UserService] Email dispatch failed for ${cleanEmail}`);
            throw new APIError(
                httpStatus.INTERNAL_SERVER_ERROR,
                "Unable to send verification email. Please check that the email address is correct and try again."
            );
        }

        return {
            success: true,
            message: `Verification code sent to ${cleanEmail}`,
            email: cleanEmail,
            devOtp: process.env.NODE_ENV === "development" ? otpCode : undefined,
        };
    }

    /**
     * Step 2: Verify Email Change via Email OTP
     */
    public async verifyEmailChange(userId: string, newEmail: string, code: string) {
        const cleanEmail = newEmail.toLowerCase().trim();
        const redisKey = `change-email:otp:${userId}`;

        const { redis } = await import("@/config/redis");
        const storedDataRaw = await redis.getValue(redisKey);

        if (!storedDataRaw) {
            throw new APIError(httpStatus.BAD_REQUEST, "Invalid or expired verification code.");
        }

        let storedData: { email: string; code: string };
        try {
            storedData = JSON.parse(storedDataRaw);
        } catch {
            throw new APIError(httpStatus.BAD_REQUEST, "Invalid verification request state.");
        }

        if (storedData.email !== cleanEmail || storedData.code !== code.trim()) {
            throw new APIError(httpStatus.BAD_REQUEST, "Incorrect verification code or email address.");
        }

        // Delete Redis key so OTP can't be reused
        await redis.deleteValue(redisKey);

        // Update email and mark verified
        const updatedUser = await db.user.update({
            where: { id: userId },
            data: {
                email: cleanEmail,
                isEmailVerified: true,
            },
        });

        return {
            success: true,
            message: "Email address verified and updated successfully.",
            user: updatedUser,
        };
    }
}

export const userService = new UserService();

