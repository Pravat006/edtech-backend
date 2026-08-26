import crypto from "crypto";
import { redis } from "@/config/redis";
import envVars from "@/config/envVars";
import { logger } from "@/config/logger";

export interface CacheKeyParams {
    provider: string;
    model: string;
    promptVersion: string;
    courseId?: string;
    lessonId?: string;
    question: string;
}

export class ResponseCacheService {
    private generateKey(params: CacheKeyParams): string {
        const normalizedQuestion = params.question.trim().toLowerCase().replace(/\s+/g, " ");

        const cacheInput = JSON.stringify({
            v: "v1",
            provider: params.provider,
            model: params.model,
            promptVersion: params.promptVersion,
            courseId: params.courseId || "general",
            lessonId: params.lessonId || "none",
            q: normalizedQuestion,
        });

        const hash = crypto.createHash("sha256").update(cacheInput).digest("hex");
        return `ai-cache:${hash}`;
    }

    public async getCachedResponse(params: CacheKeyParams): Promise<string | null> {
        try {
            const key = this.generateKey(params);
            return await redis.getValue(key);
        } catch (error) {
            logger.error("[ResponseCacheService] Error reading from cache:", error);
            return null; // Gracefully fail open on Redis errors
        }
    }

    public async cacheResponse(params: CacheKeyParams, responseText: string): Promise<void> {
        try {
            const key = this.generateKey(params);
            const ttl = envVars.AI_CACHE_TTL_SECONDS || 86400;
            await redis.setValue(key, responseText, ttl);
        } catch (error) {
            logger.error("[ResponseCacheService] Error saving to cache:", error);
        }
    }
}

export const responseCacheService = new ResponseCacheService();
