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
    EMAIL_FROM_ADDRESS: z.string().trim().email().default("noreply@supermind.com"),
    EMAIL_FROM_NAME: z.string().trim().default("Supermind Education Platform"),

    SMTP_HOST: z.string().trim().optional(),
    SMTP_PORT: z.coerce.number().int().positive().default(587),
    SMTP_USER: z.string().trim().optional(),
    SMTP_PASSWORD: z.string().trim().optional(),
    SMTP_PASS: z.string().trim().optional(),

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
});

// Define the config type using Zod inference
export type EnvConfig = z.infer<typeof EnvConfigSchema>;

// Load raw configuration from environment variables
const rawConfig = {
    PORT: process.env.PORT,
    NODE_ENV: process.env.NODE_ENV,
    DATABASE_URL: process.env.DATABASE_URL,
    JWT_SECRET: process.env.JWT_SECRET,
    SESSION_SECRET: process.env.SESSION_SECRET,
    REDIS_HOST: process.env.REDIS_HOST,
    REDIS_PORT: process.env.REDIS_PORT,
    REDIS_DB: process.env.REDIS_DB,
    REDIS_URL: process.env.REDIS_URL,
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
} = envVars;

export default envVars;
