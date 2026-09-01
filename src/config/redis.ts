import RedisService from "@/services/redis.service";
import envVars from "@/config/envVars";

export const redis = global.redis || new RedisService();

// BullMQ requires maxRetriesPerRequest: null
export const bullMqConnectionOptions = envVars.REDIS_URL
    ? { url: envVars.REDIS_URL, maxRetriesPerRequest: null }
    : {
        host: envVars.REDIS_HOST,
        port: Number(envVars.REDIS_PORT),
        db: Number(envVars.REDIS_DB),
        maxRetriesPerRequest: null
    };
