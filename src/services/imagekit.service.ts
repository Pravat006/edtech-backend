import { imagekit } from "@/config/imagekit.config";
import envVars from "@/config/envVars";
import crypto from "crypto";

export class ImageKitService {
    /**
     * Generates authentication parameters for client-side uploads.
     */
    public getAuthenticationParameters() {
        return imagekit.helper.getAuthenticationParameters();
    }

    /**
     * Generates a signed URL for secure video streaming or private image access.
     * @param url The base ImageKit URL of the file
     * @param expiresInSeconds Time in seconds until the URL expires (default: 2 hours)
     */
    public getSignedUrl(url: string, expiresInSeconds: number = 7200) {
        return imagekit.helper.buildSrc({
            src: url,
            urlEndpoint: envVars.IMAGEKIT_URL_ENDPOINT,
            signed: true,
            expiresIn: expiresInSeconds,
        });
    }

    /**
     * Verifies the HMAC signature from an ImageKit webhook using a
     * constant-time comparison to prevent timing attacks.
     */
    public verifyWebhookSignature(body: string, signature: string, timestamp: string): boolean {
        if (!envVars.IMAGEKIT_WEBHOOK_SECRET || !signature) {
            return false;
        }

        const expectedSignature = crypto
            .createHmac("sha256", envVars.IMAGEKIT_WEBHOOK_SECRET)
            .update(body + timestamp)
            .digest("hex");

        const expectedBuf = Buffer.from(expectedSignature, "hex");
        const actualBuf = Buffer.from(signature, "hex");

        // timingSafeEqual throws on length mismatch — guard first
        if (expectedBuf.length !== actualBuf.length) {
            return false;
        }

        return crypto.timingSafeEqual(expectedBuf, actualBuf);
    }

    /**
     * Deletes a file from ImageKit storage using its fileId.
     * Throws on failure — callers decide how to handle it.
     */
    public async deleteFile(fileId: string) {
        return await imagekit.files.delete(fileId);
    }
}

export const imagekitService = new ImageKitService();

