import type { NextFunction, Request, Response } from "express";
import { RateLimiterRedis } from "rate-limiter-flexible";
import { redis } from "@/config/redis";
import envVars from "@/config/envVars";
import httpStatus from "http-status";

// Helper to send rate limit response
const sendRateLimitResponse = (res: Response, rlRes: any) => {
    res.set("Retry-After", String(Math.round(rlRes.msBeforeNext / 1000)) || "1");
    res.status(httpStatus.TOO_MANY_REQUESTS).json({
        success: false,
        message: "Too many requests. Please try again later.",
        retryAfterMs: rlRes.msBeforeNext
    });
};

// 1. Public Endpoint Limiter (Moderate, per-IP)
const publicRateLimiterInstance = new RateLimiterRedis({
    storeClient: redis,
    keyPrefix: "rl_public",
    points: envVars.RL_PUBLIC_MAX,
    duration: envVars.RL_PUBLIC_WINDOW_MS / 1000, 
});

export const publicRateLimiter = async (req: Request, res: Response, next: NextFunction) => {
    const ip = req.ip || req.socket.remoteAddress || "unknown_ip";
    try {
        await publicRateLimiterInstance.consume(ip);
        next();
    } catch (rlRes) {
        sendRateLimitResponse(res, rlRes);
    }
};

// 2. Authenticated Endpoint Limiter (Loose, per-User ID)
const authUserRateLimiterInstance = new RateLimiterRedis({
    storeClient: redis,
    keyPrefix: "rl_auth_user",
    points: envVars.RL_AUTH_USER_MAX,
    duration: envVars.RL_AUTH_USER_WINDOW_MS / 1000, 
});

export const authenticatedRateLimiter = async (req: Request, res: Response, next: NextFunction) => {
    // Fallback to IP if req.user is missing for some reason
    const key = req.user?.id ? `user_${req.user.id}` : `ip_${req.ip || req.socket.remoteAddress}`;
    try {
        await authUserRateLimiterInstance.consume(key);
        next();
    } catch (rlRes) {
        sendRateLimitResponse(res, rlRes);
    }
};

// 3. Auth Endpoints Limiter (Strict, IP & Account, Exponential Backoff)
const authIpRateLimiter = new RateLimiterRedis({
    storeClient: redis,
    keyPrefix: "rl_auth_strict_ip",
    points: envVars.RL_AUTH_IP_MAX,
    duration: envVars.RL_AUTH_IP_WINDOW_MS / 1000,
});

const authAccountRateLimiter = new RateLimiterRedis({
    storeClient: redis,
    keyPrefix: "rl_auth_account",
    points: envVars.RL_AUTH_ACCOUNT_MAX,
    duration: envVars.RL_AUTH_ACCOUNT_BLOCK_MS / 1000,
});

export const authEndpointLimiter = async (req: Request, res: Response, next: NextFunction) => {
    const ip = req.ip || req.socket.remoteAddress || "unknown_ip";
    
    // Extract potential account identifiers (email or phone)
    const identifier = req.body?.email || req.body?.phoneNumber || req.body?.credential;
    const accountKey = identifier ? `${ip}_${identifier}` : ip;

    try {
        // We will try to consume a point from both limiters. 
        // If either throws, it means limit exceeded.
        
        // 1. Consume Account-based limit (Brute-force protection)
        // By default we consume 1 point. But to simulate exponential backoff on failures,
        // we can dynamically block. For simplicity, we just use the strict limits here.
        // True exponential backoff would require overriding the blockDuration based on consumed points,
        // but consuming points across the default duration effectively handles this.
        const accountRes = await authAccountRateLimiter.get(accountKey);
        
        if (accountRes !== null && accountRes.consumedPoints > envVars.RL_AUTH_ACCOUNT_MAX) {
            // Calculate exponential backoff duration based on attempts
            const backoffMultiplier = Math.pow(2, accountRes.consumedPoints - envVars.RL_AUTH_ACCOUNT_MAX);
            const blockDurationMs = envVars.RL_AUTH_ACCOUNT_BLOCK_MS * backoffMultiplier;
            
            // Re-block with exponential duration
            await authAccountRateLimiter.block(accountKey, blockDurationMs / 1000);
            return sendRateLimitResponse(res, { msBeforeNext: blockDurationMs });
        }
        
        // Consume points
        await authAccountRateLimiter.consume(accountKey);
        await authIpRateLimiter.consume(ip);
        
        next();
    } catch (rlRes) {
        sendRateLimitResponse(res, rlRes);
    }
};
