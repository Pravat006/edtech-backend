import { IMediaProvider, UploadAuthParams, CompleteUploadInput } from "./media-provider.interface";
import S3Service from "@/services/s3.service";
import { db } from "@/config/database";
import { MediaType } from "../../../../generated/prisma";

export class S3MediaProvider implements IMediaProvider {
    public readonly name = "S3" as const;
    private s3Service: S3Service;

    constructor() {
        this.s3Service = new S3Service();
    }

    public getAuthParameters(): UploadAuthParams {
        return {
            provider: "S3",
            signature: "S3_DIRECT_PRESIGNED",
        };
    }

    public async completeUpload(input: CompleteUploadInput) {
        const mediaType = this.getMediaType(input.mimeType);

        const mediaAsset = await db.mediaAsset.create({
            data: {
                type: mediaType,
                mimeType: input.mimeType,
                storageKey: input.storageKey || input.fileId,
                provider: "S3",
                sizeBytes: input.size,
                uploadStrategy: "SINGLE_PART",
                uploadStatus: "COMPLETED",
                url: input.url,
            },
        });

        return mediaAsset;
    }

    public async deleteFile(storageKey: string): Promise<boolean> {
        try {
            await this.s3Service.deleteObject(storageKey);
            return true;
        } catch {
            return false;
        }
    }

    private getMediaType(mimeType: string): MediaType {
        if (mimeType.startsWith("image/")) return "IMAGE";
        if (mimeType.startsWith("video/")) return "VIDEO";
        return "PDF";
    }
}
