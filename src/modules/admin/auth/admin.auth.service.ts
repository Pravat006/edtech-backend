import { db } from "@/config/database";
import argon2 from "argon2";
import crypto from "crypto";
import { APIError } from "@/utils/APIError";
import httpStatus from "http-status";
import { AdminLogin } from "./admin.auth.schema";
import { generateTokens, verifyToken, Payload, isRefreshTokenValid, revokeRefreshToken } from "@/services/token.service";

class AdminAuthService {
    public async login(data: AdminLogin) {
        const admin = await db.admin.findUnique({ where: { email: data.email } });
        if (!admin) {
            throw new APIError(httpStatus.UNAUTHORIZED, "Invalid email or password");
        }

        if (admin.isActive === false) {
            throw new APIError(httpStatus.FORBIDDEN, "Your administrator account has been deactivated. Please contact Super Admin.");
        }

        const isValidPassword = await argon2.verify(admin.password, data.password);
        if (!isValidPassword) {
            throw new APIError(httpStatus.UNAUTHORIZED, "Invalid email or password");
        }

        const jti = crypto.randomUUID();
        const tokens = generateTokens({
            id: admin.id,
            jti,
            role: admin.role,
        });

        // Hide password
        const { password, ...safeAdmin } = admin;

        return {
            admin: safeAdmin,
            tokens,
        };
    }

    public async refreshTokens(token: string) {
        const decodedToken = verifyToken(token) as Payload;
        if (!decodedToken || !decodedToken.role) {
            throw new APIError(httpStatus.UNAUTHORIZED, "Invalid or expired admin refresh token");
        }

        const admin = await db.admin.findUnique({ where: { id: decodedToken.id } });
        if (!admin) {
            throw new APIError(httpStatus.NOT_FOUND, "Admin not found");
        }

        if (admin.isActive === false) {
            throw new APIError(httpStatus.FORBIDDEN, "Your administrator account has been deactivated.");
        }

        const isValidInRedis = isRefreshTokenValid(admin.id, decodedToken.jti, token);
        if (!isValidInRedis) {
            throw new APIError(httpStatus.UNAUTHORIZED, "Refresh token has been revoked or is invalid");
        }

        const jti = crypto.randomUUID();
        const tokens = generateTokens({
            id: admin.id,
            jti,
            role: admin.role,
        });

        return tokens;
    }

    public logout(token: string) {
        try {
            const decodedToken = verifyToken(token) as Payload;
            revokeRefreshToken(decodedToken.id, decodedToken.jti);
        } catch (err) {
            // Ignore
        }
    }

    public async changeSuperAdminPassword(adminId: string, currentPassword: string, newPassword: string) {
        const admin = await db.admin.findUnique({ where: { id: adminId } });
        if (!admin) {
            throw new APIError(httpStatus.NOT_FOUND, "Admin account not found");
        }

        const isValid = await argon2.verify(admin.password, currentPassword);
        if (!isValid) {
            throw new APIError(httpStatus.BAD_REQUEST, "Current password is incorrect");
        }

        const hashedPassword = await argon2.hash(newPassword);
        await db.admin.update({
            where: { id: adminId },
            data: { password: hashedPassword },
        });

        // Purge Redis sessions for this admin
        const { redis } = await import("@/config/redis");
        await redis.deleteValue(`admin:${adminId}`);

        return { message: "Password updated successfully. Please log in with your new password." };
    }

    public async initiateSuperAdminEmailChange(adminId: string, newEmail: string) {
        const cleanEmail = newEmail.toLowerCase().trim();

        const existingAdmin = await db.admin.findUnique({ where: { email: cleanEmail } });
        if (existingAdmin) {
            throw new APIError(httpStatus.BAD_REQUEST, `Email address '${cleanEmail}' is already in use by another admin.`);
        }

        // Generate 6-digit OTP
        const otp = Math.floor(100000 + Math.random() * 900000).toString();

        const { redis } = await import("@/config/redis");
        const redisKey = `admin:email-otp:${adminId}`;
        const payload = JSON.stringify({ newEmail: cleanEmail, otp });

        // Save OTP in Redis with 10-minute expiry (600 seconds)
        await redis.setValue(redisKey, payload, 600);

        // Send OTP via SMTP email service
        try {
            const mailService = (await import("@/services/email.service")).default;
            await mailService.sendEmail({
                to: cleanEmail,
                subject: "Super Admin Email Change OTP Verification",
                html: `<p>Your 6-digit verification code to update your Super Admin email address is: <strong>${otp}</strong>. This code will expire in 10 minutes.</p>`,
            });
        } catch (err) {
            // Log fallback for dev/local environments
            const { logger } = await import("@/config/logger");
            logger.info(`[SuperAdminEmailOTP] OTP for ${cleanEmail}: ${otp}`);
        }

        return {
            success: true,
            message: `A 6-digit OTP has been sent to ${cleanEmail}. Please verify to complete email update.`,
            devNotice: process.env.NODE_ENV !== "production" ? `[DEV OTP]: ${otp}` : undefined,
        };
    }

    public async verifySuperAdminEmailChange(adminId: string, newEmail: string, otp: string) {
        const cleanEmail = newEmail.toLowerCase().trim();
        const { redis } = await import("@/config/redis");
        const redisKey = `admin:email-otp:${adminId}`;

        const storedData = await redis.getValue(redisKey);
        if (!storedData) {
            throw new APIError(httpStatus.BAD_REQUEST, "OTP has expired or email change was not initiated.");
        }

        const { newEmail: targetEmail, otp: expectedOtp } = JSON.parse(storedData);
        if (targetEmail !== cleanEmail || expectedOtp !== otp.trim()) {
            throw new APIError(httpStatus.BAD_REQUEST, "Invalid OTP or email mismatch.");
        }

        // Update email in PostgreSQL
        await db.admin.update({
            where: { id: adminId },
            data: { email: cleanEmail },
        });

        // Delete Redis OTP key
        await redis.deleteValue(redisKey);

        return {
            success: true,
            message: `Super Admin email successfully updated to ${cleanEmail}.`,
        };
    }

    public async acceptInvite(data: { token: string; password: string }) {
        let email: string | undefined;
        try {
            // Attempt decoding token if passed as encoded token
            const decoded = JSON.parse(Buffer.from(data.token, "base64").toString("utf-8"));
            email = decoded.email;
        } catch {
            // Fallback: token string used directly
            email = data.token;
        }

        const admin = await db.admin.findFirst({
            where: {
                OR: [
                    { email: email },
                    { id: data.token },
                ],
            },
        });

        if (!admin) {
            throw new APIError(httpStatus.BAD_REQUEST, "Invalid or expired invitation token.");
        }

        const hashedPassword = await argon2.hash(data.password);

        await db.admin.update({
            where: { id: admin.id },
            data: {
                password: hashedPassword,
                isActive: true,
            },
        });

        return { message: "Account activated successfully. You can now log in." };
    }
}

export const adminAuthService = new AdminAuthService();
