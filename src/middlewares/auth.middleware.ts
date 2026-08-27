import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { APIError } from "@/utils/APIError";
import envVars from "@/config/envVars";
import { db } from "@/config/db";
import { Admin, User } from "@/@types/schema";
import { logger } from "@/config/logger";
import { redis } from "@/config/redis";

declare global {
    namespace Express {
        interface Request {
            user?: User;
            admin?: Admin;
        }
    }
}

export const authenticateUser = async (req: Request, res: Response, next: NextFunction) => {
        const authHeader = req.headers.authorization;

        // Check for Bearer token
        if (!authHeader || !authHeader.startsWith("Bearer ")) {
            logger.warn(
                "[AUTH_MIDDLEWARE] No Bearer token found in Authorization header",
            );
            throw new APIError(
                401,
                "Authentication required. Please provide a valid token.",
            );
        }

        const token = authHeader.split(" ")[1];

        try {
            // Verify the token
            const decoded = jwt.verify(
                token,
                envVars.JWT_SECRET,
            ) as jwt.JwtPayload;

            // Check if payload has the required properties
            if (!decoded.id || !decoded.jti) {
                throw new APIError(401, "Invalid token payload.");
            }
            // Check Redis Cache first
            const cacheKey = `user:${decoded.id}`;
            const cachedUser = await redis.getValue(cacheKey);

            let user: User | null = null;

            if (cachedUser) {
                user = JSON.parse(cachedUser) as User;
            } else {
                // Cache Miss: Query DB
                user = await db.user.findUnique({ where: { id: decoded.id } }) as User | null;
                
                if (!user) {
                    throw new APIError(
                        401,
                        "Unauthorized. User associated with this token not found.",
                    );
                }
                
                // Save to Cache for 1 hour (3600 seconds)
                await redis.setValue(cacheKey, JSON.stringify(user), 3600);
            }

            // Attach user to the request object
            req.user = user;

            logger.info(
                `[AUTH_MIDDLEWARE] User authenticated successfully: ${user.id}`,
            );

            next();
        } catch (error) {
            if (error instanceof APIError) {
                throw error;
            }
            if (error instanceof jwt.TokenExpiredError) {
                logger.warn("[AUTH_MIDDLEWARE] JWT token expired");
                throw new APIError(
                    401,
                    "Token has expired. Please log in again.",
                );
            }
            if (error instanceof jwt.JsonWebTokenError) {
                logger.warn("[AUTH_MIDDLEWARE] Invalid JWT token");
                throw new APIError(401, "Invalid token. Please log in again.");
            }
            logger.error(
                "[AUTH_MIDDLEWARE] Unexpected authentication error:",
                error,
            );
            throw new APIError(
                500,
                "An unexpected error occurred during user authentication.",
            );
        }
    };

export const optionalAuthenticateUser = async (req: Request, res: Response, next: NextFunction) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
        return next();
    }

    const token = authHeader.split(" ")[1];
    try {
        const decoded = jwt.verify(token, envVars.JWT_SECRET) as jwt.JwtPayload;
        if (decoded?.id && decoded?.jti) {
            const cacheKey = `user:${decoded.id}`;
            const cachedUser = await redis.getValue(cacheKey);
            if (cachedUser) {
                req.user = JSON.parse(cachedUser) as User;
            } else {
                const user = (await db.user.findUnique({ where: { id: decoded.id } })) as User | null;
                if (user) {
                    req.user = user;
                    await redis.setValue(cacheKey, JSON.stringify(user), 3600);
                }
            }
        }
    } catch {
        // Silently catch token errors in optional auth
    }
    next();
};
