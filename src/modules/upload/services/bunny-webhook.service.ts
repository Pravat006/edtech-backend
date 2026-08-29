import { db, FileStatus } from "@/config/database";
import { logger } from "@/config/logger";
import { redis } from "@/config/redis";
import { BUNNY_STREAM_LIBRARY_ID } from "@/config/env";

export interface BunnyWebhookPayload {
    VideoLibraryId: number | string;
    VideoGuid: string;
    Status: number;
    Title?: string;
    EventId?: string;
    [key: string]: any;
}

export class BunnyWebhookService {
    private static readonly STATUS_RANK: Record<FileStatus, number> = {
        INITIATED: 1,
        UPLOADING: 2,
        COMPLETED: 3,
        FAILED: 4,
    };

    /**
     * Maps Bunny.net numeric status code to Prisma FileStatus enum
     * Official Status codes:
     * 0 = Created (INITIATED)
     * 1 = Uploaded / Uploading (UPLOADING)
     * 2 = Processing / Transcoding (UPLOADING)
     * 3 = Transcoded (COMPLETED - Ready for Playback)
     * 4 = Error (FAILED)
     * 5 = Direct Upload Failed (FAILED)
     */
    public static mapBunnyStatusToDomain(status: number): FileStatus {
        switch (status) {
            case 3:
                return FileStatus.COMPLETED;
            case 2:
            case 1:
                return FileStatus.UPLOADING;
            case 4:
            case 5:
                return FileStatus.FAILED;
            case 0:
            default:
                return FileStatus.INITIATED;
        }
    }

    /**
     * Processes incoming Bunny Webhook event with status hierarchy guard & Redis idempotency
     */
    public async processEvent(payload: BunnyWebhookPayload): Promise<{ success: boolean; message: string }> {
        const videoId = payload.VideoGuid;
        const statusNum = payload.Status;
        const domainStatus = BunnyWebhookService.mapBunnyStatusToDomain(statusNum);
        const eventId = payload.EventId || `${videoId}:${statusNum}`;

        // Step 1: Idempotency check with Redis outage fallback
        const lockKey = `bunny:event:${eventId}`;
        try {
            const isDuplicate = await redis.getValue(lockKey);
            if (isDuplicate) {
                logger.info(`[BunnyWebhookService] Idempotency hit: Event '${eventId}' already processed`);
                return { success: true, message: "Duplicate event ignored" };
            }
            await redis.setValue(lockKey, "1", 86400);
        } catch (redisError) {
            logger.warn("[BunnyWebhookService] Redis operation failed; falling back to DB status rank check:", redisError);
        }

        logger.info(`[BunnyWebhookService] Processing webhook for video ${videoId}: Status ${statusNum} -> ${domainStatus}`);

        // Step 2: Find associated MediaAsset by videoId or storageKey
        const media = await db.mediaAsset.findFirst({
            where: {
                OR: [
                    { storageKey: videoId },
                    { url: { contains: videoId } },
                ],
            },
        });

        if (!media) {
            logger.warn(`[BunnyWebhookService] MediaAsset not found in DB for videoId: ${videoId}`);
            return { success: true, message: "MediaAsset record not found, webhook acknowledged" };
        }

        // Step 3: Out-of-Order Webhook Protection (Status Hierarchy Guard)
        const currentRank = BunnyWebhookService.STATUS_RANK[media.uploadStatus as FileStatus] || 0;
        const incomingRank = BunnyWebhookService.STATUS_RANK[domainStatus] || 0;

        // Prevent regressions (e.g. status 2 arriving after status 3 COMPLETED)
        if (media.uploadStatus === FileStatus.COMPLETED && domainStatus !== FileStatus.FAILED) {
            logger.info(`[BunnyWebhookService] Status regression ignored: MediaAsset ${media.id} is already COMPLETED`);
            return { success: true, message: "MediaAsset is already COMPLETED" };
        }

        if (currentRank > incomingRank && domainStatus !== FileStatus.FAILED) {
            logger.info(`[BunnyWebhookService] Out-of-order event ignored: Current rank ${currentRank} > Incoming rank ${incomingRank}`);
            return { success: true, message: "Out-of-order event ignored" };
        }

        // Step 4: Update MediaAsset record with uploadStatus and HLS playback URL
        const libraryId = payload.VideoLibraryId || BUNNY_STREAM_LIBRARY_ID || "";
        const hlsUrl = `https://iframe.mediadelivery.net/embed/${libraryId}/${videoId}`;

        await db.mediaAsset.update({
            where: { id: media.id },
            data: {
                uploadStatus: domainStatus,
                url: hlsUrl,
            },
        });

        logger.info(`[BunnyWebhookService] Updated MediaAsset ${media.id} uploadStatus to ${domainStatus}`);
        return { success: true, message: `MediaAsset updated to ${domainStatus}` };
    }
}

export const bunnyWebhookService = new BunnyWebhookService();
