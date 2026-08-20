import status from "http-status";
import { APIError as ApiError } from "@/utils/APIError";
import { ApiResponse } from "@/utils/ApiResponse";
import { Request, Response, NextFunction } from "express";
import {
    abortUpload,
    complete,
    initiateUpload,
    getMultipartUrls,
    getImageKitAuthParams,
    completeImageKitUpload
} from "./upload.service";
import { imageKitCompleteSchema } from "./upload.schema";

export const initiateUploadController = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const userId = req.user?.id;

        if (!userId) {
            throw new ApiError(status.UNAUTHORIZED, "Unauthorized action")
        }

        const { filename, size, mimeType } = req.body;
        // folder is optional , if not provided then null 
        const { folderId } = req.params;
        //    create actual file record in db

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
        const { fileId, parts } = req.body

        await complete(fileId, parts)

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

import envVars from "@/config/envVars";

export const getImageKitAuthParamsController = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const userId = req.user?.id || req.admin?.id;
        if (!userId) throw new ApiError(status.UNAUTHORIZED, "Unauthorized action");

        const authParams = getImageKitAuthParams();
        
        res.status(status.OK).json(
            new ApiResponse(status.OK, "ImageKit auth params generated successfully", {
                ...authParams,
                publicKey: envVars.IMAGEKIT_PUBLIC_KEY,
            })
        );
    } catch (error) {
        next(error);
    }
};

export const completeImageKitUploadController = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const userId = req.user?.id || req.admin?.id;
        if (!userId) throw new ApiError(status.UNAUTHORIZED, "Unauthorized action");

        const parsedData = imageKitCompleteSchema.parse(req.body);
        const mediaAsset = await completeImageKitUpload(userId, parsedData);

        res.status(status.OK).json(
            new ApiResponse(status.OK, "ImageKit upload registered successfully", mediaAsset)
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
        const { fileId, parts } = req.body
        const urls = await getMultipartUrls(fileId, parts)

        res.status(status.OK).json(
            new ApiResponse(status.OK, "Multipart urls generated successfully", urls)
        );
    } catch (error) {
        next(error);
    }
};