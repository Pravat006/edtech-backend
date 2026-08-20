import { imagekit } from "@/config/imagekit.config";
import envVars from "@/config/envVars";
import { db } from "@/config/database";
import crypto from "crypto";
import { logger } from "@/config/logger";

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

/**
 * Deletes an old MediaAsset from ImageKit CDN and PostgreSQL whenever a new
 * MediaAsset replaces it. Deletes the CDN file first — the DB row is only
 * removed once the CDN delete succeeds, so a failed CDN call leaves the row
 * in place for retry instead of silently orphaning the CDN file.
 */
export const cleanupOldMediaAsset = async (
    oldAssetId: string | null | undefined,
    newAssetId?: string | null
): Promise<void> => {
    if (!oldAssetId || oldAssetId === newAssetId) return;

    try {
        const oldAsset = await db.mediaAsset.findUnique({ where: { id: oldAssetId } });
        if (!oldAsset) return;

        // Ensure the old asset is not still referenced by another course or lesson block
        const isCourseUsing = await db.course.findFirst({
            where: { thumbnailMediaId: oldAssetId },
            select: { id: true },
        });
        const isLessonContentUsing = await db.lessonContent.findFirst({
            where: { mediaId: oldAssetId },
            select: { id: true },
        });

        if (isCourseUsing || isLessonContentUsing) {
            // Still in use elsewhere, skip deletion
            return;
        }

        if (oldAsset.provider === "IMAGEKIT" && oldAsset.storageKey) {
            try {
                await imagekitService.deleteFile(oldAsset.storageKey);
            } catch (err) {
                logger.error("Failed to delete file from ImageKit; skipping DB cleanup for retry", {
                    mediaAssetId: oldAssetId,
                    storageKey: oldAsset.storageKey,
                    err,
                });
                return; // don't delete the DB row — leave it for a retry pass
            }
        }

        await db.mediaAsset.delete({ where: { id: oldAssetId } });
    } catch (err) {
        logger.error("cleanupOldMediaAsset failed", { mediaAssetId: oldAssetId, err });
    }
};
