import { IMediaProvider, UploadAuthParams, CompleteUploadInput } from "./media-provider.interface";
import { imagekitService } from "@/services/imagekit.service";
import { db } from "@/config/database";
import { MediaType } from "../../../../generated/prisma";

export class ImageKitMediaProvider implements IMediaProvider {
    public readonly name = "IMAGEKIT" as const;

    public getAuthParameters(): UploadAuthParams {
        const params = imagekitService.getAuthenticationParameters();
        return {
            provider: "IMAGEKIT",
            token: params.token,
            expire: params.expire,
            signature: params.signature,
            publicKey: process.env.IMAGEKIT_PUBLIC_KEY || "",
            endpoint: process.env.IMAGEKIT_URL_ENDPOINT || "",
        };
    }

    public async completeUpload(input: CompleteUploadInput) {
        const mediaType = this.getMediaType(input.mimeType);

        const mediaAsset = await db.mediaAsset.create({
            data: {
                type: mediaType,
                mimeType: input.mimeType,
                storageKey: input.fileId, // ImageKit fileId
                provider: "IMAGEKIT",
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
            await imagekitService.deleteFile(storageKey);
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
