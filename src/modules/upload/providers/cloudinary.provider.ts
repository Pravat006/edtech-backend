import { v2 as cloudinary } from "cloudinary";
import { IMediaProvider, UploadAuthParams, CompleteUploadInput } from "./media-provider.interface";
import { db } from "@/config/database";
import { MediaType } from "../../../../generated/prisma";

export class CloudinaryMediaProvider implements IMediaProvider {
    public readonly name = "CLOUDINARY" as const;

    constructor() {
        cloudinary.config({
            cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
            api_key: process.env.CLOUDINARY_API_KEY,
            api_secret: process.env.CLOUDINARY_API_SECRET,
            secure: true,
        });
    }

    public getAuthParameters(): UploadAuthParams {
        const timestamp = Math.round(new Date().getTime() / 1000);
        const apiSecret = process.env.CLOUDINARY_API_SECRET || "";
        const apiKey = process.env.CLOUDINARY_API_KEY || "";
        const cloudName = process.env.CLOUDINARY_CLOUD_NAME || "";
        const uploadPreset = process.env.CLOUDINARY_UPLOAD_PRESET || "unsigned_lms_uploads";

        const paramsToSign: Record<string, any> = {
            timestamp,
        };

        const signature = cloudinary.utils.api_sign_request(paramsToSign, apiSecret);

        return {
            provider: "CLOUDINARY",
            signature,
            timestamp,
            apiKey,
            cloudName,
            uploadPreset,
            endpoint: `https://api.cloudinary.com/v1_1/${cloudName}/auto/upload`,
        };
    }

    public async completeUpload(input: CompleteUploadInput) {
        const mediaType = this.getMediaType(input.mimeType);

        const mediaAsset = await db.mediaAsset.create({
            data: {
                type: mediaType,
                mimeType: input.mimeType,
                storageKey: input.storageKey || input.fileId,
                provider: "CLOUDINARY",
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
            const res = await cloudinary.uploader.destroy(storageKey);
            return res.result === "ok";
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
