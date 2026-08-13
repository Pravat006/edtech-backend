import RedisService from "@/services/redis.service";

export const redis = global.redis || new RedisService();
