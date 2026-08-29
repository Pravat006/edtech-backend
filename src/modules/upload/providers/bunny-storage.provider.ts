import { IMediaProvider, UploadAuthParams, CompleteUploadInput } from "./media-provider.interface";
import { logger } from "@/config/logger";
import { APIError } from "@/utils/APIError";
import httpStatus from "http-status";
import { BUNNY_STORAGE_ZONE_NAME, BUNNY_STORAGE_API_KEY, BUNNY_STORAGE_ENDPOINT, BUNNY_CDN_HOSTNAME } from "@/config/env";
import { db } from "@/config/database";
import { MediaType } from "../../../../generated/prisma";

export class BunnyStorageMediaProvider implements IMediaProvider {
    public readonly name = "BUNNY_STORAGE";

    private get zoneName(): string {
        return BUNNY_STORAGE_ZONE_NAME || "";
    }

    private get apiKey(): string {
        return BUNNY_STORAGE_API_KEY || "";
    }

    private get endpointHost(): string {
        return BUNNY_STORAGE_ENDPOINT || "storage.bunnycdn.com";
    }

    private get cdnHost(): string {
        return BUNNY_CDN_HOSTNAME || `${this.zoneName}.b-cdn.net`;
    }

    public getAuthParameters(): UploadAuthParams {
        if (!this.zoneName || !this.apiKey) {
            throw new APIError(
                httpStatus.INTERNAL_SERVER_ERROR,
                "Bunny Storage configuration missing (BUNNY_STORAGE_ZONE_NAME or BUNNY_STORAGE_API_KEY)"
            );
        }

        const expire = Math.floor(Date.now() / 1000) + 3600;
        return {
            provider: "BUNNY_STORAGE",
            signature: this.apiKey,
            expire,
            endpoint: `https://${this.endpointHost}/${this.zoneName}/`,
            publicKey: this.cdnHost,
        };
    }

    public async completeUpload(input: CompleteUploadInput): Promise<any> {
        const publicUrl = input.url.startsWith("http")
            ? input.url
            : `https://${this.cdnHost}/${input.storageKey || input.fileId}`;

        const mimeType = input.mimeType || "application/octet-stream";
        let mediaType: MediaType = "IMAGE";
        if (mimeType.startsWith("video/")) mediaType = "VIDEO";
        else if (mimeType === "application/pdf") mediaType = "PDF";

        const mediaAsset = await db.mediaAsset.create({
            data: {
                type: mediaType,
                url: publicUrl,
                mimeType,
                storageKey: input.storageKey || input.fileId || `file_${Date.now()}`,
                provider: this.name,
                bucket: this.zoneName,
                region: "global",
                sizeBytes: input.size,
                uploadStrategy: "SINGLE_PART",
                uploadStatus: "COMPLETED",
            },
        });

        return {
            id: mediaAsset.id,
            fileId: mediaAsset.id,
            url: mediaAsset.url,
            storageKey: mediaAsset.storageKey,
            size: mediaAsset.sizeBytes,
            mimeType: mediaAsset.mimeType,
            bucket: mediaAsset.bucket,
            region: mediaAsset.region,
        };
    }

    public async uploadDirect(file: string | Buffer, fileName: string): Promise<{ url: string; fileId: string }> {
        if (!this.zoneName || !this.apiKey) {
            throw new APIError(
                httpStatus.INTERNAL_SERVER_ERROR,
                "Bunny Storage configuration missing (BUNNY_STORAGE_ZONE_NAME or BUNNY_STORAGE_API_KEY)"
            );
        }

        const safeFileName = fileName.replace(/[^a-zA-Z0-9_.-]/g, "_");
        const uploadUrl = `https://${this.endpointHost}/${this.zoneName}/${safeFileName}`;

        let buffer: Buffer;
        if (typeof file === "string") {
            const base64Data = file.includes(";base64,") ? file.split(";base64,")[1] : file;
            buffer = Buffer.from(base64Data, "base64");
        } else {
            buffer = file;
        }

        const res = await fetch(uploadUrl, {
            method: "PUT",
            headers: {
                "AccessKey": this.apiKey,
                "Content-Type": "application/octet-stream",
            },
            body: buffer,
        });

        if (!res.ok) {
            throw new APIError(
                httpStatus.INTERNAL_SERVER_ERROR,
                `Bunny Storage upload failed with status ${res.status}`
            );
        }

        const cdnUrl = `https://${this.cdnHost}/${safeFileName}`;
        return {
            url: cdnUrl,
            fileId: safeFileName,
        };
    }

    public async deleteFile(storageKey: string): Promise<boolean> {
        if (!this.zoneName || !this.apiKey) {
            logger.warn("[BunnyStorage] Cannot delete file, missing storage credentials");
            return false;
        }

        const url = `https://${this.endpointHost}/${this.zoneName}/${storageKey}`;
        try {
            const res = await fetch(url, {
                method: "DELETE",
                headers: {
                    "AccessKey": this.apiKey,
                },
                signal: AbortSignal.timeout(5000),
            });

            if (!res.ok && res.status !== 404) {
                logger.error(`[BunnyStorage] Delete file failed (${res.status})`);
                return false;
            }

            return true;
        } catch (error: any) {
            logger.error("[BunnyStorage] Error in deleteFile:", error);
            return false;
        }
    }
}
