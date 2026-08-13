import status from "http-status";
import { APIError as ApiError } from "@/utils/APIError";
import { ApiResponse } from "@/utils/ApiResponse";
import { Request, Response, NextFunction } from "express";
import {
    abortUpload,
    complete,
    initiateUpload,
    getMultipartUrls
} from "./upload.service";

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