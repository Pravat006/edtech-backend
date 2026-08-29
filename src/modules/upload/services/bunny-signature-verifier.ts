import crypto from "crypto";
import { logger } from "@/config/logger";
import { BUNNY_WEBHOOK_SECRET, BUNNY_STREAM_TOKEN_KEY } from "@/config/env";

export class BunnySignatureVerifier {
    /**
     * Official Bunny Stream Webhook Signature Verification
     * Verifies x-bunny-signature or X-BunnyStream-Signature header against computed HMAC/SHA256 digest
     */
    public static verifySignature(
        rawSignature: string | undefined,
        libraryId: string,
        videoId: string,
        rawBody?: string,
        webhookSecret?: string
    ): boolean {
        const secret = webhookSecret || BUNNY_WEBHOOK_SECRET || BUNNY_STREAM_TOKEN_KEY || "";
        
        if (!secret) {
            logger.warn("[BunnySignatureVerifier] No webhook secret configured; signature validation bypassed in dev");
            return true;
        }

        if (!rawSignature) {
            logger.error("[BunnySignatureVerifier] Missing webhook signature header");
            return false;
        }

        const cleanSig = rawSignature.trim().toLowerCase();

        // Check 1: HMAC-SHA256 of raw request body if rawBody is provided
        if (rawBody) {
            const hmac = crypto.createHmac("sha256", secret).update(rawBody).digest("hex").toLowerCase();
            if (crypto.timingSafeEqual(Buffer.from(cleanSig), Buffer.from(hmac))) {
                return true;
            }
            // Also test HMAC-SHA1 for legacy webhook compatibility
            const hmacSha1 = crypto.createHmac("sha1", secret).update(rawBody).digest("hex").toLowerCase();
            if (crypto.timingSafeEqual(Buffer.from(cleanSig), Buffer.from(hmacSha1))) {
                return true;
            }
        }

        // Check 2: Canonical SHA-256 hash (secret + libraryId + videoId)
        const expectedHash = crypto
            .createHash("sha256")
            .update(`${secret}${libraryId}${videoId}`)
            .digest("hex")
            .toLowerCase();

        if (cleanSig.length === expectedHash.length) {
            const isValid = crypto.timingSafeEqual(
                Buffer.from(cleanSig),
                Buffer.from(expectedHash)
            );
            if (isValid) return true;
        }

        logger.error(`[BunnySignatureVerifier] Signature verification failed. Header: ${rawSignature}`);
        return false;
    }
}
