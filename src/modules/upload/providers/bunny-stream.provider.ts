import crypto from "crypto";
import { IVideoStreamProvider, VideoSlotResult, VideoUploadAuth } from "./media-provider.interface";
import { logger } from "@/config/logger";
import { APIError } from "@/utils/APIError";
import httpStatus from "http-status";
import { BUNNY_STREAM_LIBRARY_ID, BUNNY_STREAM_API_KEY, BUNNY_STREAM_TOKEN_KEY, BUNNY_STREAM_ENABLED_RESOLUTIONS } from "@/config/env";

export class BunnyStreamMediaProvider implements IVideoStreamProvider {
    public readonly name = "BUNNY_STREAM";

    private get libraryId(): string {
        return BUNNY_STREAM_LIBRARY_ID || "";
    }

    private get apiKey(): string {
        return BUNNY_STREAM_API_KEY || "";
    }

    private get tokenKey(): string {
        return BUNNY_STREAM_TOKEN_KEY || "";
    }

    private ensureConfig() {
        if (!this.libraryId || !this.apiKey) {
            throw new APIError(
                httpStatus.INTERNAL_SERVER_ERROR,
                "Bunny Stream configuration missing (BUNNY_STREAM_LIBRARY_ID or BUNNY_STREAM_API_KEY)"
            );
        }
    }

    /**
     * Official Bunny Stream API: Create Video Placeholder Slot
     * POST https://video.bunnycdn.com/library/{libraryId}/videos
     */
    public async createVideoSlot(title: string): Promise<VideoSlotResult> {
        this.ensureConfig();

        const url = `https://video.bunnycdn.com/library/${this.libraryId}/videos`;
        try {
            const res = await fetch(url, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Accept": "application/json",
                    "AccessKey": this.apiKey,
                },
                body: JSON.stringify({
                    title,
                    enabledResolutions: BUNNY_STREAM_ENABLED_RESOLUTIONS || "240p,360p,480p,720p,1080p",
                }),
                signal: AbortSignal.timeout(5000),
            });

            if (!res.ok) {
                const errText = await res.text();
                logger.error(`[BunnyStream] Create video slot failed (${res.status}): ${errText}`);
                throw new APIError(httpStatus.BAD_GATEWAY, `Bunny Stream API error: ${res.statusText}`);
            }

            const data = (await res.json()) as any;
            const libId = String(data.videoLibraryId || this.libraryId);
            return {
                videoGuid: data.guid,
                libraryId: libId,
                title: data.title || title,
                status: data.status ?? 0,
                bucket: libId,
                region: "global",
            };
        } catch (error: any) {
            logger.error("[BunnyStream] Error in createVideoSlot:", error);
            if (error instanceof APIError) throw error;
            throw new APIError(httpStatus.INTERNAL_SERVER_ERROR, "Failed to create Bunny Stream video slot");
        }
    }

    /**
     * Official Bunny Stream TUS Resumable Upload Authentication
     * Signature Formula: SHA256_HEX(libraryId + apiKey + expiration + videoId)
     */
    public async getVideoUploadAuth(videoId: string): Promise<VideoUploadAuth> {
        this.ensureConfig();

        const expiration = Math.floor(Date.now() / 1000) + 3600; // 1 hour TTL
        const hashInput = `${this.libraryId}${this.apiKey}${expiration}${videoId}`;
        const signature = crypto.createHash("sha256").update(hashInput).digest("hex");

        return {
            videoGuid: videoId,
            libraryId: this.libraryId,
            signature,
            expiration,
            tusEndpoint: "https://video.bunnycdn.com/tusupload",
        };
    }

    /**
     * Official Bunny Stream Embed View Token Signing
     * Signature Formula: SHA256_HEX(token_security_key + video_id + expiration + [user_ip])
     */
    public generateSignedEmbedUrl(videoId: string, userIp?: string, ttlSeconds = 7200): string {
        this.ensureConfig();

        const expiration = Math.floor(Date.now() / 1000) + ttlSeconds;
        const secret = this.tokenKey || this.apiKey;
        const hashInput = userIp ? `${secret}${videoId}${expiration}${userIp}` : `${secret}${videoId}${expiration}`;
        const token = crypto.createHash("sha256").update(hashInput).digest("hex");

        return `https://iframe.mediadelivery.net/embed/${this.libraryId}/${videoId}?token=${token}&expires=${expiration}`;
    }

    /**
     * Official Bunny Stream API: Delete Video
     * DELETE https://video.bunnycdn.com/library/{libraryId}/videos/{videoId}
     */
    public async deleteVideo(videoId: string): Promise<boolean> {
        this.ensureConfig();

        const url = `https://video.bunnycdn.com/library/${this.libraryId}/videos/${videoId}`;
        try {
            const res = await fetch(url, {
                method: "DELETE",
                headers: {
                    "AccessKey": this.apiKey,
                },
                signal: AbortSignal.timeout(5000),
            });

            if (!res.ok && res.status !== 404) {
                const errText = await res.text();
                logger.error(`[BunnyStream] Delete video failed (${res.status}): ${errText}`);
                return false;
            }

            return true;
        } catch (error: any) {
            logger.error("[BunnyStream] Error in deleteVideo:", error);
            return false;
        }
    }
    /**
     * Official Bunny Stream API: Get Video Status
     * GET https://video.bunnycdn.com/library/{libraryId}/videos/{videoId}
     */
    public async getVideoStatus(videoId: string): Promise<number | null> {
        this.ensureConfig();

        const url = `https://video.bunnycdn.com/library/${this.libraryId}/videos/${videoId}`;
        try {
            const res = await fetch(url, {
                method: "GET",
                headers: {
                    "Accept": "application/json",
                    "AccessKey": this.apiKey,
                },
                signal: AbortSignal.timeout(5000),
            });

            if (!res.ok) {
                return null;
            }

            const data = (await res.json()) as any;
            return data.status ?? null;
        } catch (error) {
            logger.error("[BunnyStream] Error in getVideoStatus:", error);
            return null;
        }
    }
}
