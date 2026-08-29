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

export const authenticateUserOrAdmin = async (req: Request, res: Response, next: NextFunction) => {
    const adminCookie = req.cookies?.admin_access_token;
    const authHeader = req.headers.authorization;
    let bearerToken: string | undefined;

    if (authHeader && authHeader.startsWith("Bearer ")) {
        bearerToken = authHeader.split(" ")[1];
    }

    // 1. Try Admin HTTP-only Cookie first
    if (adminCookie) {
        try {
            const decoded = jwt.verify(adminCookie, envVars.JWT_SECRET) as jwt.JwtPayload;
            if (decoded?.id) {
                const cacheKey = `admin:${decoded.id}`;
                const cachedAdmin = await redis.getValue(cacheKey);
                if (cachedAdmin) {
                    req.admin = JSON.parse(cachedAdmin) as Admin;
                    return next();
                }
                const admin = await db.admin.findUnique({ where: { id: decoded.id } });
                if (admin) {
                    req.admin = admin as Admin;
                    await redis.setValue(cacheKey, JSON.stringify(admin), 3600);
                    return next();
                }
            }
        } catch {
            // Ignore cookie error and try Bearer token if present
        }
    }

    // 2. Try Authorization Bearer Header (User or Admin)
    if (bearerToken) {
        try {
            const decoded = jwt.verify(bearerToken, envVars.JWT_SECRET) as jwt.JwtPayload;
            if (decoded?.id) {
                // Check User Cache/DB
                const userCacheKey = `user:${decoded.id}`;
                const cachedUser = await redis.getValue(userCacheKey);
                if (cachedUser) {
                    req.user = JSON.parse(cachedUser) as User;
                    return next();
                }
                const user = await db.user.findUnique({ where: { id: decoded.id } });
                if (user) {
                    req.user = user as User;
                    await redis.setValue(userCacheKey, JSON.stringify(user), 3600);
                    return next();
                }

                // Fallback check for Admin Bearer token
                const adminCacheKey = `admin:${decoded.id}`;
                const cachedAdmin = await redis.getValue(adminCacheKey);
                if (cachedAdmin) {
                    req.admin = JSON.parse(cachedAdmin) as Admin;
                    return next();
                }
                const admin = await db.admin.findUnique({ where: { id: decoded.id } });
                if (admin) {
                    req.admin = admin as Admin;
                    await redis.setValue(adminCacheKey, JSON.stringify(admin), 3600);
                    return next();
                }
            }
        } catch (error) {
            if (error instanceof jwt.TokenExpiredError) {
                throw new APIError(401, "Token has expired. Please log in again.");
            }
            if (error instanceof jwt.JsonWebTokenError) {
                throw new APIError(401, "Invalid token. Please log in again.");
            }
        }
    }

    throw new APIError(401, "Authentication required. Please provide valid credentials.");
};

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
