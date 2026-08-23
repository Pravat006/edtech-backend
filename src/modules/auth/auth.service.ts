import crypto from "crypto";
import { db } from "@/config/database";
import { smsService } from "@/services/sms.service";
import httpStatus from "http-status";
import { APIError } from "@/utils/APIError";
import {
    generateTokens,
    Payload,
    verifyToken,
    isRefreshTokenValid,
    revokeRefreshToken,
} from "@/services/token.service";
import { ProfileSetup, Login, SetPassword, ChangePassword } from "./auth.schema";
import envVars from "@/config/envVars";
import jwt from "jsonwebtoken";
import * as argon2 from "argon2";

class AuthService {
    public async checkUserExists(phoneNumber: string) {
        const user = await db.user.findUnique({
            where: { phoneNumber },
            select: { password: true }
        });
        return !!user && !!user.password;
    }

    public async sendOtp(phoneNumber: string) {
        try {
            return await smsService.sendOtp(phoneNumber);
        } catch (err: any) {
            if (err.message.includes("1 minute")) {
                throw new APIError(httpStatus.TOO_MANY_REQUESTS, err.message);
            }
            console.error("SMS Sending Error:", err);
            throw new APIError(httpStatus.INTERNAL_SERVER_ERROR, err.message || "Failed to send OTP.");
        }
    }

    public async verifyOtp(phoneNumber: string, otp: string) {
        const verificationResult = await smsService.verifyOtp(phoneNumber, otp);
        if (!verificationResult.success) {
            throw new APIError(httpStatus.UNAUTHORIZED, verificationResult.reason || "Invalid or expired OTP.");
        }

        let user = await db.user.findUnique({
            where: { phoneNumber },
            include: { referralCode: true }
        });
        let isNewUser = false;

        if (!user) {
            const uniqueCode = crypto.randomBytes(4).toString("hex").toUpperCase();

            user = await db.user.create({
                data: {
                    phoneNumber,
                    referralCode: {
                        create: {
                            code: uniqueCode
                        }
                    }
                },
                include: { referralCode: true }
            });
            isNewUser = true;
        }

        const setupToken = jwt.sign(
            { phoneNumber, userId: user.id }, 
            envVars.JWT_SECRET, 
            { expiresIn: '15m' }
        );

        return {
            isNewUser,
            setupToken
        };
    }

    public async setPassword(data: SetPassword) {
        let decoded: any;
        try {
            decoded = jwt.verify(data.setupToken, envVars.JWT_SECRET);
        } catch (err) {
            throw new APIError(httpStatus.UNAUTHORIZED, "Invalid or expired setup token.");
        }

        const userId = decoded.userId;

        const hashedPassword = await argon2.hash(data.password);

        const user = await db.user.update({
            where: { id: userId },
            data: { password: hashedPassword }
        });

        const jti = crypto.randomUUID();
        const { accessToken, refreshToken } = generateTokens({
            id: user.id,
            jti,
        });

        return {
            user,
            tokens: {
                accessToken,
                refreshToken,
            }
        };
    }

    public async login(data: Login) {
        const user = await db.user.findUnique({
            where: { phoneNumber: data.phoneNumber }
        });

        if (!user || !user.password) {
            throw new APIError(
                httpStatus.UNAUTHORIZED, 
                "Account not found or password not set. Please use forgot password."
            );
        }

        const isValidPassword = await argon2.verify(user.password, data.password);
        if (!isValidPassword) {
            throw new APIError(httpStatus.UNAUTHORIZED, "Invalid phone number or password.");
        }

        const jti = crypto.randomUUID();
        const { accessToken, refreshToken } = generateTokens({
            id: user.id,
            jti,
        });

        return {
            user,
            tokens: {
                accessToken,
                refreshToken,
            }
        };
    }

    public async changePassword(userId: string, data: ChangePassword) {
        const user = await db.user.findUnique({
            where: { id: userId }
        });

        if (!user || !user.password) {
            throw new APIError(
                httpStatus.UNAUTHORIZED, 
                "Account not found or password not set. Please use forgot password."
            );
        }

        const isValidPassword = await argon2.verify(user.password, data.oldPassword);
        if (!isValidPassword) {
            throw new APIError(httpStatus.UNAUTHORIZED, "Incorrect old password.");
        }

        const hashedNewPassword = await argon2.hash(data.newPassword);

        await db.user.update({
            where: { id: userId },
            data: { password: hashedNewPassword }
        });

        return { success: true };
    }

    public async setupProfile(userId: string, data: ProfileSetup) {
        return await db.user.update({
            where: { id: userId },
            data,
        });
    }

    public async refreshTokens(token: string) {
        const decodedToken = verifyToken(token) as Payload;
        if (!decodedToken) {
            throw new APIError(httpStatus.UNAUTHORIZED, "Invalid or expired refresh token");
        }

        const user = await db.user.findUnique({ where: { id: decodedToken.id } });
        if (!user) {
            throw new APIError(httpStatus.NOT_FOUND, "User not found");
        }

        const isValidInRedis = isRefreshTokenValid(user.id, decodedToken.jti, token);
        if (!isValidInRedis) {
            throw new APIError(httpStatus.UNAUTHORIZED, "Refresh token has been revoked or is invalid");
        }

        const jti = crypto.randomUUID();
        const { accessToken, refreshToken: newRefreshToken } = generateTokens({
            id: user.id,
            jti,
        });

        return { accessToken, refreshToken: newRefreshToken };
    }

    public logout(token: string) {
        try {
            const decodedToken = verifyToken(token) as Payload;
            revokeRefreshToken(decodedToken.id, decodedToken.jti);
        } catch (err) {
            // Ignore token verification errors on logout
        }
    }
}

export const authService = new AuthService();
