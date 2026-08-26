import { Pool } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../../generated/prisma";
export * from "../../generated/prisma";
import { DATABASE_URL } from "@/config/env";
import { logger } from "./logger";
import RedisService from "@/services/redis.service";

declare global {
    var prisma: PrismaClient;
    var redis: RedisService;
}

const connectionString = DATABASE_URL;

if (process.env.NODE_ENV === "production" && (connectionString.includes("localhost") || connectionString.includes("127.0.0.1"))) {
    logger.error("[PRISMA] CRITICAL ERROR: Production environment is configured with a local DATABASE_URL!");
    throw new Error("[PRISMA] Cannot use local database in production environment");
}

const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);

export const db =
    global.prisma || new PrismaClient({ adapter } as ConstructorParameters<typeof PrismaClient>[0]);

if (process.env.NODE_ENV !== "production") {
    global.prisma = db;
}

db.$connect()
    .then(() => {
        logger.info("[PRISMA] : connected to database");
    })
    .catch((error: unknown) => {
        logger.error("[PRISMA] : failed to connect database : ", error);
    });


export const redisClient = global.redis || new RedisService();

if (process.env.NODE_ENV !== "production") {
    global.redis = redisClient;
}
