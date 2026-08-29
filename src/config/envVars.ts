import dotenv from "dotenv";
import path from "path";
import { z } from "zod";
import { logger } from "./logger";

// Load environment variables from .env file
dotenv.config({ path: path.join(__dirname, "../../.env") });

// Define the environment configuration schema
const EnvConfigSchema = z.object({
    PORT: z.coerce.number().int().positive().default(3000),

    NODE_ENV: z.enum(["development", "production", "test"]).default("development"),

    ADMIN_ORIGIN: z.string().trim().optional(),
    FRONTEND_ORIGIN: z.string().trim().optional(),
    ADMIN_FRONTEND_URL: z.string().trim().optional(),

    DATABASE_URL: z.string().trim().min(1).url(),

    JWT_SECRET: z.string().trim().min(8, "JWT_SECRET must be at least 8 characters long"),

    SESSION_SECRET: z
        .string()
        .trim()
        .min(8, "SESSION_SECRET must be at least 8 characters long")
        .optional(),

    // Security
    REDIS_HOST: z.string().trim().min(1).default("localhost"),
    REDIS_PORT: z.coerce.number().int().positive().default(4567),
    REDIS_DB: z.coerce.number().int().min(0).default(0),
    REDIS_URL: z.string().trim().min(1).optional(),

    AWS_REGION: z.string().trim().min(1).default("us-east-1"),
    AWS_ACCESS_KEY_ID: z.string().trim().min(1).default("dummy"),
    AWS_SECRET_ACCESS_KEY: z.string().trim().min(1).default("dummy"),
    S3_BUCKET_NAME: z.string().trim().min(1).default("dummy"),

    // Email Configuration
    EMAIL_PROVIDER: z.enum(["brevo", "resend", "smtp"]).default("brevo"),
    BREVO_API_KEY: z.string().trim().optional(),
    RESEND_API_KEY: z.string().trim().optional(),
    EMAIL_FROM_ADDRESS: z.string().trim().email().default("noreply@xyzeducation.com"),
    EMAIL_FROM_NAME: z.string().trim().default("XYZ Education Platform"),

    SMTP_HOST: z.string().trim().optional(),
    SMTP_PORT: z.coerce.number().int().positive().default(587),
    SMTP_USER: z.string().trim().optional(),
    SMTP_PASSWORD: z.string().trim().optional(),
    SMTP_PASS: z.string().trim().optional(),

    // OTP Configuration
    OTP_PROVIDER: z.string().trim().default("mock"),

    TWILIO_ACCOUNT_SID: z.string().trim().min(1),
    TWILIO_AUTH_TOKEN: z.string().trim().min(1),
    TWILIO_VERIFY_SERVICE_SID: z.string().trim().min(1),
    TWILIO_WHATSAPP_FROM: z.string().trim().min(1).optional(),

    RAZORPAY_KEY_ID: z.string().trim().default("rzp_test_dummykey"),
    RAZORPAY_KEY_SECRET: z.string().trim().default("dummy_secret"),
    RAZORPAY_WEBHOOK_SECRET: z.string().trim().default("dummy_webhook_secret"),

    IMAGEKIT_PUBLIC_KEY: z.string().trim().min(1).default("dummy_public_key"),
    IMAGEKIT_PRIVATE_KEY: z.string().trim().min(1).default("dummy_private_key"),
    IMAGEKIT_URL_ENDPOINT: z.string().trim().min(1).url().default("https://ik.imagekit.io/dummy"),
    IMAGEKIT_WEBHOOK_SECRET: z.string().trim().optional(),

    // Bunny.net Stream & Storage Configuration
    MEDIA_STORAGE_PROVIDER: z.string().trim().default("imagekit"),
    VIDEO_STREAM_PROVIDER: z.string().trim().default("bunny_stream"),
    BUNNY_STREAM_LIBRARY_ID: z.string().trim().optional(),
    BUNNY_STREAM_API_KEY: z.string().trim().optional(),
    BUNNY_STREAM_TOKEN_KEY: z.string().trim().optional(),
    BUNNY_STREAM_ENABLED_RESOLUTIONS: z.string().trim().default("240p,360p,480p,720p,1080p"),
    BUNNY_WEBHOOK_SECRET: z.string().trim().optional(),
    BUNNY_STORAGE_ZONE_NAME: z.string().trim().optional(),
    BUNNY_STORAGE_API_KEY: z.string().trim().optional(),
    BUNNY_STORAGE_ENDPOINT: z.string().trim().default("storage.bunnycdn.com"),
    BUNNY_CDN_HOSTNAME: z.string().trim().optional(),

    // AI Doubt Solver Strategy Provider Options
    AI_ENABLED: z.coerce.boolean().default(true),
    AI_PROVIDER: z.enum(["gemini", "groq", "openrouter", "openai", "mock"]).default("mock"),
    GEMINI_API_KEY: z.string().trim().optional(),
    GEMINI_MODEL: z.string().trim().default("gemini-3.6-flash"),
    GROQ_API_KEY: z.string().trim().optional(),
    GROQ_MODEL: z.string().trim().default("llama-3.1-70b-versatile"),
    OPENROUTER_API_KEY: z.string().trim().optional(),
    OPENROUTER_MODEL: z.string().trim().default("meta-llama/llama-3.1-70b-instruct"),
    OPENAI_API_KEY: z.string().trim().optional(),
    OPENAI_MODEL: z.string().trim().default("gpt-4o-mini"),
    AI_CREDIT_COST_QUICK: z.coerce.number().default(0.10),
    AI_CREDIT_COST_DETAILED: z.coerce.number().default(0.25),
    AI_CACHE_TTL_SECONDS: z.coerce.number().default(86400),
    AI_PROMPT_VERSION: z.string().trim().default("v1"),
    AI_INITIAL_WELCOME_CREDITS: z.coerce.number().default(5),
});

// Define the config type using Zod inference
export type EnvConfig = z.infer<typeof EnvConfigSchema>;

// Load raw configuration from environment variables with automated Dev / Prod environment resolution
const isProdEnvironment = process.env.NODE_ENV === "production";

const resolvedDatabaseUrl = isProdEnvironment
    ? process.env.DATABASE_URL
    : (process.env.DEV_DATABASE_URL || "postgres://edtech:edtech_secret@127.0.0.1:5432/edtech_db");

const resolvedRedisHost = isProdEnvironment
    ? (process.env.REDIS_HOST || "localhost")
    : (process.env.LOCAL_REDIS_HOST || "127.0.0.1");

const resolvedRedisPort = isProdEnvironment
    ? (process.env.REDIS_PORT || "6379")
    : (process.env.LOCAL_REDIS_PORT || "6380");

const resolvedRedisUrl = isProdEnvironment
    ? (process.env.REDIS_URL || process.env.UPSTASH_REDIS_URL || process.env.UPSTASH_REDIS_REST_URL || process.env.KV_URL)
    : undefined;

const rawConfig = {
    PORT: process.env.PORT,
    NODE_ENV: process.env.NODE_ENV,
    ADMIN_ORIGIN: process.env.ADMIN_ORIGIN,
    FRONTEND_ORIGIN: process.env.FRONTEND_ORIGIN,
    ADMIN_FRONTEND_URL: process.env.ADMIN_FRONTEND_URL,
    DATABASE_URL: resolvedDatabaseUrl,
    JWT_SECRET: process.env.JWT_SECRET,
    SESSION_SECRET: process.env.SESSION_SECRET,
    REDIS_HOST: resolvedRedisHost,
    REDIS_PORT: resolvedRedisPort,
    REDIS_DB: process.env.REDIS_DB,
    REDIS_URL: resolvedRedisUrl,
    AWS_REGION: process.env.AWS_REGION,
    AWS_ACCESS_KEY_ID: process.env.AWS_ACCESS_KEY_ID,
    AWS_SECRET_ACCESS_KEY: process.env.AWS_SECRET_ACCESS_KEY,
    S3_BUCKET_NAME: process.env.S3_BUCKET_NAME,
    EMAIL_PROVIDER: process.env.EMAIL_PROVIDER,
    BREVO_API_KEY: process.env.BREVO_API_KEY,
    RESEND_API_KEY: process.env.RESEND_API_KEY,
    EMAIL_FROM_ADDRESS: process.env.EMAIL_FROM_ADDRESS,
    EMAIL_FROM_NAME: process.env.EMAIL_FROM_NAME,
    SMTP_HOST: process.env.SMTP_HOST,
    SMTP_PORT: process.env.SMTP_PORT,
    SMTP_USER: process.env.SMTP_USER,
    SMTP_PASSWORD: process.env.SMTP_PASSWORD,
    SMTP_PASS: process.env.SMTP_PASS,
    OTP_PROVIDER: process.env.OTP_PROVIDER,
    TWILIO_ACCOUNT_SID: process.env.TWILIO_ACCOUNT_SID,
    TWILIO_AUTH_TOKEN: process.env.TWILIO_AUTH_TOKEN,
    TWILIO_VERIFY_SERVICE_SID: process.env.TWILIO_VERIFY_SERVICE_SID,
    TWILIO_WHATSAPP_FROM: process.env.TWILIO_WHATSAPP_FROM,
    RAZORPAY_KEY_ID: process.env.RAZORPAY_KEY_ID,
    RAZORPAY_KEY_SECRET: process.env.RAZORPAY_KEY_SECRET,
    RAZORPAY_WEBHOOK_SECRET: process.env.RAZORPAY_WEBHOOK_SECRET,
    IMAGEKIT_PUBLIC_KEY: process.env.IMAGEKIT_PUBLIC_KEY,
    IMAGEKIT_PRIVATE_KEY: process.env.IMAGEKIT_PRIVATE_KEY,
    IMAGEKIT_URL_ENDPOINT: process.env.IMAGEKIT_URL_ENDPOINT,
    IMAGEKIT_WEBHOOK_SECRET: process.env.IMAGEKIT_WEBHOOK_SECRET,
    MEDIA_STORAGE_PROVIDER: process.env.MEDIA_STORAGE_PROVIDER || process.env.MEDIA_PROVIDER,
    VIDEO_STREAM_PROVIDER: process.env.VIDEO_STREAM_PROVIDER,
    BUNNY_STREAM_LIBRARY_ID: process.env.BUNNY_STREAM_LIBRARY_ID,
    BUNNY_STREAM_API_KEY: process.env.BUNNY_STREAM_API_KEY,
    BUNNY_STREAM_TOKEN_KEY: process.env.BUNNY_STREAM_TOKEN_KEY,
    BUNNY_STREAM_ENABLED_RESOLUTIONS: process.env.BUNNY_STREAM_ENABLED_RESOLUTIONS,
    BUNNY_WEBHOOK_SECRET: process.env.BUNNY_WEBHOOK_SECRET,
    BUNNY_STORAGE_ZONE_NAME: process.env.BUNNY_STORAGE_ZONE_NAME,
    BUNNY_STORAGE_API_KEY: process.env.BUNNY_STORAGE_API_KEY,
    BUNNY_STORAGE_ENDPOINT: process.env.BUNNY_STORAGE_ENDPOINT || "storage.bunnycdn.com",
    BUNNY_CDN_HOSTNAME: process.env.BUNNY_CDN_HOSTNAME,
    AI_ENABLED: process.env.AI_ENABLED,
    AI_PROVIDER: process.env.AI_PROVIDER,
    GEMINI_API_KEY: process.env.GEMINI_API_KEY,
    GEMINI_MODEL: process.env.GEMINI_MODEL,
    GROQ_API_KEY: process.env.GROQ_API_KEY,
    GROQ_MODEL: process.env.GROQ_MODEL,
    OPENROUTER_API_KEY: process.env.OPENROUTER_API_KEY,
    OPENROUTER_MODEL: process.env.OPENROUTER_MODEL,
    OPENAI_API_KEY: process.env.OPENAI_API_KEY,
    OPENAI_MODEL: process.env.OPENAI_MODEL,
    AI_CREDIT_COST_QUICK: process.env.AI_CREDIT_COST_QUICK,
    AI_CREDIT_COST_DETAILED: process.env.AI_CREDIT_COST_DETAILED,
    AI_CACHE_TTL_SECONDS: process.env.AI_CACHE_TTL_SECONDS,
    AI_PROMPT_VERSION: process.env.AI_PROMPT_VERSION,
    AI_INITIAL_WELCOME_CREDITS: process.env.AI_INITIAL_WELCOME_CREDITS,
};

// Validate and parse configuration
let envVars: EnvConfig;

try {
    envVars = EnvConfigSchema.parse(rawConfig);
    logger.info("Environment configuration loaded.");
} catch (error) {
    if (error instanceof z.ZodError) {
        logger.error(
            "Environment configuration validation failed:",
            error.issues,
        );
        error.issues.forEach((issue) => {
            logger.error(`- ${issue.path.join(".")}: ${issue.message}`);
        });
    } else {
        logger.error(
            "Unknown error during environment config validation:",
            error,
        );
    }

    // Throw error to prevent application from starting with invalid config
    throw new Error(
        "Environment configuration validation failed. Check environment variables.",
    );
}

// Export individual config values for convenience
export const {
    PORT,
    NODE_ENV,
    ADMIN_ORIGIN,
    FRONTEND_ORIGIN,
    ADMIN_FRONTEND_URL,
    DATABASE_URL,
    JWT_SECRET,
    REDIS_HOST,
    REDIS_PORT,
    REDIS_DB,
    REDIS_URL,
    AWS_REGION,
    AWS_ACCESS_KEY_ID,
    AWS_SECRET_ACCESS_KEY,
    S3_BUCKET_NAME,
    SMTP_HOST,
    SMTP_PORT,
    SMTP_USER,
    SMTP_PASSWORD,
    OTP_PROVIDER,
    TWILIO_ACCOUNT_SID,
    TWILIO_AUTH_TOKEN,
    TWILIO_VERIFY_SERVICE_SID,
    TWILIO_WHATSAPP_FROM,
    RAZORPAY_KEY_ID,
    RAZORPAY_KEY_SECRET,
    RAZORPAY_WEBHOOK_SECRET,
    IMAGEKIT_PUBLIC_KEY,
    IMAGEKIT_PRIVATE_KEY,
    IMAGEKIT_URL_ENDPOINT,
    IMAGEKIT_WEBHOOK_SECRET,
    MEDIA_STORAGE_PROVIDER,
    VIDEO_STREAM_PROVIDER,
    BUNNY_STREAM_LIBRARY_ID,
    BUNNY_STREAM_API_KEY,
    BUNNY_STREAM_TOKEN_KEY,
    BUNNY_STREAM_ENABLED_RESOLUTIONS,
    BUNNY_WEBHOOK_SECRET,
    BUNNY_STORAGE_ZONE_NAME,
    BUNNY_STORAGE_API_KEY,
    BUNNY_STORAGE_ENDPOINT,
    BUNNY_CDN_HOSTNAME,
    AI_ENABLED,
    AI_PROVIDER,
    GEMINI_API_KEY,
    GEMINI_MODEL,
    GROQ_API_KEY,
    GROQ_MODEL,
    OPENROUTER_API_KEY,
    OPENROUTER_MODEL,
    OPENAI_API_KEY,
    OPENAI_MODEL,
    AI_CREDIT_COST_QUICK,
    AI_CREDIT_COST_DETAILED,
    AI_CACHE_TTL_SECONDS,
    AI_PROMPT_VERSION,
    AI_INITIAL_WELCOME_CREDITS,
} = envVars;

export default envVars;
