import status from "http-status";
import { APIError as ApiError } from "@/utils/APIError";
import { ApiResponse } from "@/utils/ApiResponse";
import { Request, Response, NextFunction } from "express";
import {
    abortUpload,
    complete,
    initiateUpload,
    getMultipartUrls,
    getUploadAuthParams,
    completeClientUpload,
} from "./upload.service";
import { imageKitCompleteSchema, bunnyStorageCompleteSchema } from "./upload.schema";
import { MediaProviderFactory } from "./providers/media-provider.factory";
import { db } from "@/config/database";
import { MediaType } from "../../../generated/prisma";

export const initiateUploadController = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const userId = (req as any).user?.id || (req as any).admin?.id;

        if (!userId) {
            throw new ApiError(status.UNAUTHORIZED, "Unauthorized action");
        }

        const { filename, size, mimeType } = req.body;
        const { folderId } = req.params;

        const upload = await initiateUpload({ filename, size, mimeType, ownerId: userId, folderId });

        res.status(status.OK).json(
            new ApiResponse(status.OK, "Upload initiated successfully", upload)
        );
    } catch (error) {
        next(error);
    }
};

/**
 * complete multipart upload
 */
export const completeMultiPartUpload = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { fileId, parts } = req.body;

        await complete(fileId, parts);

        res.status(200).json(
            new ApiResponse(status.OK, "file uploaded successfully")
        );
    } catch (error) {
        next(error);
    }
};

export const abortUploadController = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { fileId } = req.body;
        await abortUpload(fileId);
        res.status(status.OK).json(
            new ApiResponse(status.OK, "file upload aborted successfully")
        );
    } catch (error) {
        next(error);
    }
};

export const getImageKitAuthParamsController = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const userId = (req as any).user?.id || (req as any).admin?.id;
        if (!userId) throw new ApiError(status.UNAUTHORIZED, "Unauthorized action");

        const providerQuery = req.query.provider as string | undefined;
        const authParams = getUploadAuthParams(providerQuery);

        res.status(status.OK).json(
            new ApiResponse(status.OK, "Upload auth params generated successfully", authParams)
        );
    } catch (error) {
        next(error);
    }
};

export const completeImageKitUploadController = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const userId = (req as any).user?.id || (req as any).admin?.id;
        if (!userId) throw new ApiError(status.UNAUTHORIZED, "Unauthorized action");

        const parsedData = imageKitCompleteSchema.parse(req.body);
        const mediaAsset = await completeClientUpload(userId, parsedData);

        res.status(status.OK).json(
            new ApiResponse(status.OK, "Media upload registered successfully", mediaAsset)
        );
    } catch (error) {
        next(error);
    }
};

/**
 * Complete Bunny Storage static upload — registers MediaAsset in DB.
 * POST /v1/media/storage/complete  (or /v1/upload/storage/complete)
 */
export const completeBunnyStorageUploadController = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const userId = (req as any).user?.id || (req as any).admin?.id;
        if (!userId) throw new ApiError(status.UNAUTHORIZED, "Unauthorized action");

        const parsed = bunnyStorageCompleteSchema.parse(req.body);

        const mimeType = parsed.mimeType;
        let mediaType: MediaType = "IMAGE";
        if (mimeType.startsWith("video/")) mediaType = "VIDEO";
        else if (mimeType === "application/pdf") mediaType = "PDF";

        const storageKey = parsed.storageKey || parsed.fileId;

        // Upsert to avoid duplicate storageKey conflicts on retries
        let mediaAsset = await db.mediaAsset.findUnique({ where: { storageKey } });
        if (!mediaAsset) {
            mediaAsset = await db.mediaAsset.create({
                data: {
                    type: mediaType,
                    url: parsed.url,
                    mimeType,
                    storageKey,
                    provider: "BUNNY_STORAGE",
                    bucket: process.env.BUNNY_STORAGE_ZONE_NAME || "",
                    region: "global",
                    sizeBytes: parsed.size,
                    uploadStrategy: "SINGLE_PART",
                    uploadStatus: "COMPLETED",
                },
            });
        }

        res.status(status.OK).json(
            new ApiResponse(status.OK, "Media asset registered successfully", {
                id: mediaAsset.id,
                fileId: mediaAsset.id,
                url: mediaAsset.url,
                storageKey: mediaAsset.storageKey,
                mimeType: mediaAsset.mimeType,
                size: mediaAsset.sizeBytes,
            })
        );
    } catch (error) {
        next(error);
    }
};

/**
 * get multipart urls
 */
export const getMultipartUrlsController = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { fileId, parts } = req.body;
        const urls = await getMultipartUrls(fileId, parts);

        res.status(status.OK).json(
            new ApiResponse(status.OK, "Multipart urls generated successfully", urls)
        );
    } catch (error) {
        next(error);
    }
};

/**
 * Bunny Stream: Create Video Placeholder Slot & TUS Upload Auth
 * POST /v1/media/video-slot
 */
export const createVideoSlotController = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const userId = (req as any).user?.id || (req as any).admin?.id;
        if (!userId) throw new ApiError(status.UNAUTHORIZED, "Unauthorized action");

        const { title = "Untitled Lesson Video" } = req.body;
        const streamProvider = MediaProviderFactory.getVideoStreamProvider();

        // 1. Create slot on Bunny Stream
        const slot = await streamProvider.createVideoSlot(title);

        // 2. Generate TUS Auth signature
        const tusAuth = await streamProvider.getVideoUploadAuth(slot.videoGuid);

        // 3. Register MediaAsset in DB
        const mediaAsset = await db.mediaAsset.create({
            data: {
                type: "VIDEO",
                mimeType: "video/mp4",
                storageKey: slot.videoGuid,
                provider: streamProvider.name,
                uploadStrategy: "SINGLE_PART",
                uploadStatus: "INITIATED",
                bucket: slot.bucket || slot.libraryId,
                region: slot.region || "global",
                url: `https://iframe.mediadelivery.net/embed/${slot.libraryId}/${slot.videoGuid}`,
            },
        });

        res.status(status.OK).json(
            new ApiResponse(status.OK, "Video slot created successfully", {
                mediaAssetId: mediaAsset.id,
                ...tusAuth,
            })
        );
    } catch (error) {
        next(error);
    }
};

/**
 * Direct Static File Upload Presigned Signature (Bunny Storage / ImageKit / S3)
 * POST /v1/media/upload-signature
 */
export const getUploadSignatureController = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const userId = (req as any).user?.id || (req as any).admin?.id;
        if (!userId) throw new ApiError(status.UNAUTHORIZED, "Unauthorized action");

        const providerQuery = (req.body.provider || req.query.provider) as string | undefined;
        const authParams = getUploadAuthParams(providerQuery);

        res.status(status.OK).json(
            new ApiResponse(status.OK, "Upload signature generated successfully", authParams)
        );
    } catch (error) {
        next(error);
    }
};

/**
 * Generate Short-Lived Signed Video Embed URL for HLS Playback
 * GET /v1/media/signed-player-url/:videoId
 */
export const getSignedPlayerUrlController = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const userId = (req as any).user?.id || (req as any).admin?.id;
        if (!userId) throw new ApiError(status.UNAUTHORIZED, "Unauthorized action");

        const videoId = req.params.videoId as string;
        const streamProvider = MediaProviderFactory.getVideoStreamProvider();
        const signedUrl = streamProvider.generateSignedEmbedUrl(videoId);

        res.status(status.OK).json(
            new ApiResponse(status.OK, "Signed video embed URL generated successfully", { signedUrl })
        );
    } catch (error) {
        next(error);
    }
};