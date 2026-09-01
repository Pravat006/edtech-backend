import type { NextFunction, Request, Response } from "express";
import { RateLimiterRedis } from "rate-limiter-flexible";
import { redis } from "@/config/redis";
import envVars from "@/config/envVars";
import httpStatus from "http-status";
import { logger } from "@/config/logger";

// Helper to send rate limit response
const sendRateLimitResponse = (res: Response, rlRes: any) => {
    const retryMs = rlRes?.msBeforeNext || 60000;
    res.set("Retry-After", String(Math.ceil(retryMs / 1000)) || "1");
    res.status(httpStatus.TOO_MANY_REQUESTS).json({
        success: false,
        message: "Too many requests. Please try again later.",
        retryAfterMs: retryMs
    });
};

// 1. Public Endpoint Limiter (Moderate, per-IP)
const publicRateLimiterInstance = new RateLimiterRedis({
    storeClient: redis,
    keyPrefix: "rl_v4_public",
    points: envVars.RL_PUBLIC_MAX || 2000,
    duration: (envVars.RL_PUBLIC_WINDOW_MS || 900000) / 1000, 
});

export const publicRateLimiter = async (req: Request, res: Response, next: NextFunction) => {
    const ip = req.ip || req.socket.remoteAddress || "unknown_ip";
    try {
        await publicRateLimiterInstance.consume(ip);
        next();
    } catch (err: any) {
        if (err && typeof err.msBeforeNext === "number") {
            sendRateLimitResponse(res, err);
        } else {
            logger.warn(`[RateLimiter] Public rate limiter bypassed due to Redis error: ${err?.message || err}`);
            next(); // Fail open on Redis errors
        }
    }
};

// 2. Authenticated Endpoint Limiter (Loose, per-User ID)
const authUserRateLimiterInstance = new RateLimiterRedis({
    storeClient: redis,
    keyPrefix: "rl_v4_auth_user",
    points: envVars.RL_AUTH_USER_MAX || 5000,
    duration: (envVars.RL_AUTH_USER_WINDOW_MS || 900000) / 1000, 
});

export const authenticatedRateLimiter = async (req: Request, res: Response, next: NextFunction) => {
    const key = (req as any).user?.id ? `user_${(req as any).user.id}` : `ip_${req.ip || req.socket.remoteAddress}`;
    try {
        await authUserRateLimiterInstance.consume(key);
        next();
    } catch (err: any) {
        if (err && typeof err.msBeforeNext === "number") {
            sendRateLimitResponse(res, err);
        } else {
            logger.warn(`[RateLimiter] Auth user rate limiter bypassed due to Redis error: ${err?.message || err}`);
            next(); // Fail open on Redis errors
        }
    }
};

// 3. Strict Auth Endpoints Limiter (Login, OTP Send/Verify)
const authIpRateLimiter = new RateLimiterRedis({
    storeClient: redis,
    keyPrefix: "rl_v4_auth_strict_ip",
    points: envVars.RL_AUTH_IP_MAX || 120,
    duration: (envVars.RL_AUTH_IP_WINDOW_MS || 900000) / 1000,
});

const authAccountRateLimiter = new RateLimiterRedis({
    storeClient: redis,
    keyPrefix: "rl_v4_auth_account",
    points: envVars.RL_AUTH_ACCOUNT_MAX || 30,
    duration: (envVars.RL_AUTH_ACCOUNT_BLOCK_MS || 120000) / 1000,
});

export const authEndpointLimiter = async (req: Request, res: Response, next: NextFunction) => {
    const ip = req.ip || req.socket.remoteAddress || "unknown_ip";
    const identifier = req.body?.email || req.body?.phoneNumber || req.body?.credential;
    const accountKey = identifier ? `${ip}_${identifier}` : ip;

    try {
        await authAccountRateLimiter.consume(accountKey);
        await authIpRateLimiter.consume(ip);
        next();
    } catch (err: any) {
        if (err && typeof err.msBeforeNext === "number") {
            sendRateLimitResponse(res, err);
        } else {
            logger.warn(`[RateLimiter] Auth endpoint limiter bypassed due to Redis error: ${err?.message || err}`);
            next(); // Fail open on Redis errors
        }
    }
};


