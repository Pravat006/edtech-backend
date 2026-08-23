import S3Service from "@/services/s3.service";
import { MediaProviderFactory } from "./providers/media-provider.factory";
import { CompleteUploadInput } from "./providers/media-provider.interface";
import { APIError } from "@/utils/APIError";
import { db } from "@/config/database";
import { v4 as uuidv4 } from "uuid";
import { MediaType } from "../../../generated/prisma";
import { ImageKitCompleteSchema } from "./upload.schema";

type UploadOptions = {
    filename: string;
    size: number;
    mimeType: string;
    ownerId: string;
    folderId?: string;
};

const s3Service = new S3Service();

/**
 * Get client upload auth parameters from active media provider (ImageKit, Cloudinary, S3)
 */
export const getUploadAuthParams = (providerName?: string) => {
    const provider = MediaProviderFactory.getProvider(providerName);
    return provider.getAuthParameters();
};

/**
 * Backwards compatible helper for ImageKit auth
 */
export const getImageKitAuthParams = () => {
    return getUploadAuthParams("imagekit");
};

/**
 * Complete single-part client upload via active provider
 */
export const completeClientUpload = async (userId: string, data: ImageKitCompleteSchema) => {
    const provider = MediaProviderFactory.getProvider();
    const input: CompleteUploadInput = {
        userId,
        fileId: data.fileId,
        url: data.url,
        mimeType: data.mimeType,
        size: data.size,
    };
    return await provider.completeUpload(input);
};

/**
 * Backwards compatible helper for ImageKit completion
 */
export const completeImageKitUpload = async (userId: string, data: ImageKitCompleteSchema) => {
    return completeClientUpload(userId, data);
};

const getMediaType = (mimeType: string): MediaType => {
    if (mimeType.startsWith("image/")) return "IMAGE";
    if (mimeType.startsWith("video/")) return "VIDEO";
    if (mimeType === "application/pdf") return "PDF";
    return "PDF";
};

export const initiateUpload = async (options: UploadOptions) => {
    const strategy = s3Service.decideStrategy(BigInt(options.size));
    const mediaType = getMediaType(options.mimeType);
    const key = `uploads/${options.ownerId}/${uuidv4()}/${options.filename}`;

    const mediaAsset = await db.mediaAsset.create({
        data: {
            type: mediaType,
            mimeType: options.mimeType,
            storageKey: key,
            provider: "S3",
            sizeBytes: options.size,
            uploadStrategy: strategy,
            uploadStatus: "INITIATED",
            url: "",
        },
    });

    let uploadId: string | undefined;
    let preSignedUrls: string[] = [];

    try {
        if (strategy === "SINGLE_PART") {
            const url = await s3Service.getPutObjectUrl(key, options.mimeType);
            preSignedUrls.push(url);
        } else {
            const multipart = await s3Service.createMultipartUpload(key, options.mimeType);
            uploadId = multipart.UploadId;

            await db.mediaAsset.update({
                where: { id: mediaAsset.id },
                data: { uploadId },
            });
        }

        return {
            fileId: mediaAsset.id,
            strategy,
            key,
            uploadId,
            preSignedUrls,
        };
    } catch (error) {
        if (uploadId) {
            await s3Service.abortMultipartUpload(key, uploadId);
        }

        await db.mediaAsset.update({
            where: { id: mediaAsset.id },
            data: { uploadStatus: "FAILED" },
        });

        throw new APIError(500, "Failed to initiate upload");
    }
};

export const getMultipartUrls = async (fileId: string, parts: number) => {
    const file = await db.mediaAsset.findUnique({ where: { id: fileId } });

    if (!file) {
        throw new APIError(404, "File not found");
    }
    if (file.uploadStrategy !== "MULTIPART" || !file.uploadId) {
        throw new APIError(400, "File is not a multipart file");
    }

    const urls: { partNumber: number; url: string }[] = [];
    for (let i = 1; i <= parts; i++) {
        const url = await s3Service.getUploadPartUrl(file.storageKey, i, file.uploadId);
        urls.push({ partNumber: i, url });
    }
    return urls;
};

export const complete = async (fileId: string, parts?: { ETag: string; PartNumber: number }[]) => {
    return await db.$transaction(async (tx) => {
        const file = await tx.mediaAsset.findUnique({
            where: { id: fileId },
        });

        if (!file) throw new APIError(404, "File not found");
        if (file.uploadStatus === "COMPLETED") throw new APIError(400, "File already uploaded");

        if (file.uploadStrategy === "MULTIPART") {
            if (!file.uploadId || !parts) {
                throw new APIError(400, "Invalid file upload");
            }
            await s3Service.completeMultiPartUpload(file.storageKey, file.uploadId, parts);
        }

        const fileUrl = `https://s3.amazonaws.com/${file.storageKey}`;

        const updatedFile = await tx.mediaAsset.update({
            where: { id: file.id },
            data: {
                uploadStatus: "COMPLETED",
                url: fileUrl,
            },
        });

        return updatedFile;
    });
};

export const abortUpload = async (fileId: string) => {
    const file = await db.mediaAsset.findUnique({ where: { id: fileId } });
    if (!file) throw new APIError(404, "File not found");

    if (file.uploadStrategy === "MULTIPART" && file.uploadId) {
        await s3Service.abortMultipartUpload(file.storageKey, file.uploadId);
    } else {
        await s3Service.deleteObject(file.storageKey);
    }

    await db.mediaAsset.update({
        where: { id: fileId },
        data: { uploadStatus: "FAILED" },
    });

    return file;
};