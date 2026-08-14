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
}

export const adminAuthService = new AdminAuthService();
