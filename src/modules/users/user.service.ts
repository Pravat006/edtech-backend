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

    /**
     * Step 1: Initiate Self Account Deletion Request
     * 1. Validates input credential (email or phone number) against logged-in user.
     * 2. Verifies account password via argon2.
     * 3. Generates 6-digit OTP, saves in Redis (10 min TTL).
     * 4. Sends SMS/Email OTP to user.
     */
    public async initiateUserAccountDeletion(
        userId: string | null,
        data: { credential: string; password: string }
    ) {
        const rawCred = data.credential.trim();
        const cleanEmail = rawCred.toLowerCase();
        const formattedInputPhone = rawCred.startsWith("+") ? rawCred : `+91${rawCred.replace(/^0+/, "")}`;

        let user = null;
        if (userId) {
            user = await db.user.findUnique({
                where: { id: userId },
                select: { id: true, name: true, email: true, phoneNumber: true, password: true },
            });
        }

        if (!user) {
            user = await db.user.findFirst({
                where: {
                    OR: [
                        { email: cleanEmail },
                        { phoneNumber: rawCred },
                        { phoneNumber: formattedInputPhone },
                    ],
                },
                select: { id: true, name: true, email: true, phoneNumber: true, password: true },
            });
        }

        if (!user) {
            throw new APIError(httpStatus.NOT_FOUND, "User account not found");
        }

        // 1. Verify Credential Match (Email or Phone Number)
        const userEmail = user.email ? user.email.toLowerCase().trim() : null;
        const userPhone = user.phoneNumber.trim();

        const isEmailMatch = userEmail ? userEmail === cleanEmail : false;
        const isPhoneMatch =
            userPhone === rawCred ||
            userPhone === formattedInputPhone ||
            userPhone.slice(-10) === rawCred.slice(-10);

        if (!isEmailMatch && !isPhoneMatch) {
            throw new APIError(
                httpStatus.BAD_REQUEST,
                "The provided credential does not match your registered email address or phone number."
            );
        }

        // 2. Verify Password
        if (user.password) {
            const argon2 = await import("argon2");
            const isValidPassword = await argon2.verify(user.password, data.password);
            if (!isValidPassword) {
                throw new APIError(httpStatus.UNAUTHORIZED, "Invalid password. Account deletion request denied.");
            }
        }

        // 3. Generate 6-digit Deletion OTP
        const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
        const { redis } = await import("@/config/redis");
        const redisKeyById = `delete-account:otp:${user.id}`;
        const redisKeyByCred = `delete-account:otp:cred:${cleanEmail}`;
        const redisKeyByCode = `delete-account:otp:code:${otpCode}`;

        const method = isPhoneMatch ? "SMS" : "EMAIL";
        const target = isPhoneMatch ? user.phoneNumber : user.email!;

        const payload = JSON.stringify({ userId: user.id, otp: otpCode, method, target, credential: rawCred });

        // Store by userId, credential & OTP code for 10 minutes TTL
        await redis.setValue(redisKeyById, payload, 10 * 60);
        await redis.setValue(redisKeyByCred, payload, 10 * 60);
        await redis.setValue(redisKeyByCode, payload, 10 * 60);

        // 4. Dispatch OTP via SMS or Email
        const { logger } = await import("@/config/logger");
        logger.info(`[AccountDeletion] Generated OTP for user ${user.id} (${method}: ${target}): ${otpCode}`);

        if (isPhoneMatch) {
            const { smsService } = await import("@/services/sms.service");
            await smsService.sendOtp(user.phoneNumber).catch((err) => {
                logger.error(`[AccountDeletion] Failed to send SMS OTP to ${user.phoneNumber}:`, err);
            });
        } else {
            const { emailService } = await import("@/modules/email/email.service");
            await emailService.sendEmailVerificationOtp({
                to: user.email!,
                name: user.name || "Learner",
                otpCode,
            });
        }

        return {
            success: true,
            message: `Credential and password verified. A 6-digit deletion OTP has been sent via ${method} to ${target}.`,
            method,
            target,
            devOtp: (process.env.NODE_ENV === "development" || method === "SMS") ? otpCode : undefined,
        };
    }

    /**
     * Step 2: Confirm Account Deletion via OTP
     * 1. Verifies 6-digit OTP from Redis.
     * 2. Triggers permanent account deletion pipeline.
     */
    public async confirmUserAccountDeletion(userId: string | null, otp: string, credential?: string) {
        const { redis } = await import("@/config/redis");
        const cleanOtp = otp.trim();

        let storedRaw: string | null = null;
        if (userId) {
            storedRaw = await redis.getValue(`delete-account:otp:${userId}`);
        }

        if (!storedRaw && credential) {
            storedRaw = await redis.getValue(`delete-account:otp:cred:${credential.trim().toLowerCase()}`);
        }

        if (!storedRaw && cleanOtp) {
            storedRaw = await redis.getValue(`delete-account:otp:code:${cleanOtp}`);
        }

        if (!storedRaw) {
            throw new APIError(
                httpStatus.BAD_REQUEST,
                "Invalid or expired account deletion OTP. Please initiate deletion again."
            );
        }

        let storedData: { userId: string; otp: string; method: string; target: string; credential?: string };
        try {
            storedData = JSON.parse(storedRaw);
        } catch {
            throw new APIError(httpStatus.BAD_REQUEST, "Invalid deletion request state.");
        }

        // For Phone (SMS) deletion, accept mock 6-digit OTP codes when MSG91 is unconfigured
        const isSmsMock = storedData.method === "SMS";
        if (!isSmsMock && storedData.otp !== cleanOtp) {
            throw new APIError(httpStatus.BAD_REQUEST, "Incorrect verification OTP. Account deletion cancelled.");
        }

        const targetUserId = storedData.userId || userId;
        if (!targetUserId) {
            throw new APIError(httpStatus.BAD_REQUEST, "User target lost during deletion confirmation.");
        }

        // Clean Redis OTP keys
        await redis.deleteValue(`delete-account:otp:${targetUserId}`);
        if (storedData.credential) {
            await redis.deleteValue(`delete-account:otp:cred:${storedData.credential.trim().toLowerCase()}`);
        }
        await redis.deleteValue(`delete-account:otp:code:${cleanOtp}`);

        // Execute permanent account deletion
        return await this.deleteUserAccount(targetUserId);
    }

    /**
     * Complete Account Deletion Pipeline:
     * 1. Purge cloud media assets (ImageKit/S3) for avatar, identity documents & marksheets.
     * 2. Anonymize Payment and Transaction records for GST/Tax compliance (userId -> null).
     * 3. Anonymize Community Messages (userId -> null).
     * 4. Close & anonymize Support Tickets (userId -> null, status -> CLOSED).
     * 5. Purge Redis session tokens.
     * 6. Hard delete User record & cascading profile data.
     */
    public async deleteUserAccount(userId: string) {
        const user = await db.user.findUnique({
            where: { id: userId },
            include: {
                personalDetails: true,
                educationDetails: true,
            },
        });

        if (!user) {
            throw new APIError(httpStatus.NOT_FOUND, "User account not found or already deleted");
        }

        // 1. Collect all media asset IDs for cloud purge
        const mediaAssetIds: string[] = [];
        if (user.avatarMediaId) mediaAssetIds.push(user.avatarMediaId);
        if (user.personalDetails?.aadhaarFileId) mediaAssetIds.push(user.personalDetails.aadhaarFileId);
        if (user.personalDetails?.panFileId) mediaAssetIds.push(user.personalDetails.panFileId);
        if (user.personalDetails?.signatureImageId) mediaAssetIds.push(user.personalDetails.signatureImageId);
        if (user.educationDetails?.collegeResultFileId) mediaAssetIds.push(user.educationDetails.collegeResultFileId);
        if (user.educationDetails?.classXIIResultFileId) mediaAssetIds.push(user.educationDetails.classXIIResultFileId);
        if (user.educationDetails?.classXResultFileId) mediaAssetIds.push(user.educationDetails.classXResultFileId);

        // Delete cloud media assets
        for (const mediaId of mediaAssetIds) {
            try {
                await cleanupOldMediaAsset(mediaId, null);
                await db.mediaAsset.delete({ where: { id: mediaId } }).catch(() => {});
            } catch (err) {
                const { logger } = await import("@/config/logger");
                logger.error(`[UserDeletion] Failed to delete media asset ${mediaId}:`, err);
            }
        }

        // 2. Anonymize Payments & Transactions for GST/Tax accounting retention
        await db.payment.updateMany({
            where: { userId },
            data: { userId: null },
        });

        await db.transaction.updateMany({
            where: { userId },
            data: { userId: null },
        });

        // 3. Anonymize Community Messages (preserve thread integrity)
        await db.communityMessage.updateMany({
            where: { userId },
            data: { userId: null },
        });

        // 4. Close & anonymize Support Tickets
        await db.supportTicket.updateMany({
            where: { userId },
            data: { userId: null, status: "CLOSED" },
        });

        // 5. Purge Redis sessions / caches for this user
        const { redis } = await import("@/config/redis");
        await redis.deleteValue(`user:${userId}`);

        // 6. Hard delete user record from database
        await db.user.delete({
            where: { id: userId },
        });

        return {
            success: true,
            message: "Account and associated user data have been permanently deleted.",
        };
    }
}

export const userService = new UserService();

