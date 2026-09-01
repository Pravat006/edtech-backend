import { db } from "@/config/database";
import { MediaProviderFactory } from "./providers/media-provider.factory";

/**
 * Deletes an old MediaAsset from its Storage Provider (ImageKit/Bunny/S3) and PostgreSQL whenever a new
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

        if (oldAsset.storageKey && oldAsset.provider) {
            try {
                if (oldAsset.provider === "BUNNY_STREAM") {
                    const provider = MediaProviderFactory.getVideoStreamProvider();
                    const success = await provider.deleteVideo(oldAsset.storageKey);
                    if (success === false) return;
                } else {
                    const provider = MediaProviderFactory.getMediaProvider(oldAsset.provider);
                    const success = await provider.deleteFile(oldAsset.storageKey);
                    if (success === false) return;
                }
            } catch (err) {
                const { logger } = await import("@/config/logger");
                logger.error("Failed to delete file from Provider; skipping DB cleanup for retry", {
                    mediaAssetId: oldAssetId,
                    storageKey: oldAsset.storageKey,
                    provider: oldAsset.provider,
                    err,
                });
                return; // don't delete the DB row — leave it for a retry pass
            }
        }

        await db.mediaAsset.delete({ where: { id: oldAssetId } });
    } catch (err) {
        const { logger } = await import("@/config/logger");
        logger.error("cleanupOldMediaAsset failed", { mediaAssetId: oldAssetId, err });
    }
};
