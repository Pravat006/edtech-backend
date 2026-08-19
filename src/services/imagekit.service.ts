import { imagekit } from "@/config/imagekit.config";
import envVars from "@/config/envVars";
import { db } from "@/config/database";
import crypto from "crypto";

export class ImageKitService {
    /**
     * Generates authentication parameters for client-side uploads.
     * Returns a token, signature, and expire timestamp.
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
            expiresIn: expiresInSeconds
        });
    }

    /**
     * Verifies the HMAC signature from an ImageKit webhook.
     */
    public verifyWebhookSignature(body: string, signature: string, timestamp: string): boolean {
        if (!envVars.IMAGEKIT_WEBHOOK_SECRET) {
            return false;
        }
        
        const expectedSignature = crypto
            .createHmac("sha256", envVars.IMAGEKIT_WEBHOOK_SECRET)
            .update(body + timestamp)
            .digest("hex");
            
        return expectedSignature === signature;
    }

    /**
     * Deletes a file from ImageKit storage using its fileId.
     */
    public async deleteFile(fileId: string) {
        return await imagekit.files.delete(fileId);
    }
}

export const imagekitService = new ImageKitService();

/**
 * Asynchronously deletes an old MediaAsset from ImageKit CDN and PostgreSQL
 * whenever a new MediaAsset replaces it.
 */
export const cleanupOldMediaAsset = (oldAssetId: string | null | undefined, newAssetId?: string | null) => {
    if (!oldAssetId || oldAssetId === newAssetId) return;

    db.mediaAsset.findUnique({ where: { id: oldAssetId } })
        .then(async (oldAsset) => {
            if (oldAsset) {
                if (oldAsset.provider === "IMAGEKIT" && oldAsset.storageKey) {
                    await imagekitService.deleteFile(oldAsset.storageKey).catch(() => {});
                }
                await db.mediaAsset.delete({ where: { id: oldAssetId } }).catch(() => {});
            }
        })
        .catch(() => {}); // Fire-and-forget background cleanup
};
