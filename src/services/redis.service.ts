import { logger } from '@/config/logger';
import Redis from 'ioredis';
import envVars from '@/config/envVars';

class RedisService {
    private client: Redis;

    constructor() {
        if (envVars.NODE_ENV === 'production' && !envVars.REDIS_URL) {
            logger.error('[Redis] CRITICAL ERROR: REDIS_URL environment variable is missing in production environment!');
            throw new Error('[Redis] Missing REDIS_URL in production environment');
        }

        if (envVars.REDIS_URL) {
            logger.info(`[Redis] Initializing Cloud Upstash Redis client (production target).`);
            this.client = new Redis(envVars.REDIS_URL);
        } else {
            logger.info(`[Redis] Initializing Local Docker Redis client at ${envVars.REDIS_HOST}:${envVars.REDIS_PORT} (development target).`);
            this.client = new Redis({
                host: envVars.REDIS_HOST,
                port: Number(envVars.REDIS_PORT),
                db: Number(envVars.REDIS_DB),
            });
        }

        this.client.on('connect', () => logger.info('[Redis] Connecting...'));
        this.client.on('ready', () => logger.info('[Redis] Connected successfully.'));
        this.client.on('error', (err) => logger.error('[Redis] Connection error', err));
        this.client.on('end', () => logger.info('[Redis] Connection closed.'));
    }

    async connect(): Promise<void> {
        if (this.client.status === 'wait') {
            await this.client.connect();
        }
    }

    async quit(): Promise<void> {
        await this.client.quit();
    }

    async getValue(key: string): Promise<string | null> {
        const data = await this.client.get(key);
        if (data) {
            logger.info(`[Redis] CACHE HIT for key: ${key}`);
            return data;
        } else {
            logger.info(`[Redis] CACHE MISS for key: ${key}`);
            return null;
        }
    }

    async setValue(key: string, value: string, expiry?: number): Promise<boolean> {
        let result;
        if (expiry) {
            result = await this.client.set(key, value, 'EX', expiry);
        } else {
            result = await this.client.set(key, value);
        }
        return result === 'OK';
    }

    async updateValue(key: string, value: string): Promise<boolean> {
        const exists = await this.client.exists(key);
        if (exists) {
            await this.setValue(key, value);
            return true;
        }
        return false;
    }

    async deleteValue(key: string): Promise<boolean> {
        const result = await this.client.del(key);
        return result > 0;
    }

    async flushAll(): Promise<void> {
        await this.client.flushall();
    }
}

export default RedisService;