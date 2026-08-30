import { Router, Request, Response, NextFunction } from "express";
import {
    abortUploadController, completeMultiPartUpload, initiateUploadController, getMultipartUrlsController,
    getImageKitAuthParamsController, completeImageKitUploadController,
    createVideoSlotController, getUploadSignatureController, getSignedPlayerUrlController,
    completeBunnyStorageUploadController, deleteVideoSlotController, deleteStorageFileController
} from "./upload.controller";
import { authenticateUserOrAdmin } from "@/middlewares/auth.middleware";

const authMiddleware = (req: Request, res: Response, next: NextFunction) => authenticateUserOrAdmin(req, res, next);

const router = Router();

router.post('/initiate', authMiddleware, initiateUploadController);
router.post('/complete', authMiddleware, completeMultiPartUpload);
router.post('/abort', authMiddleware, abortUploadController);
router.post('/get-multipart-urls', authMiddleware, getMultipartUrlsController);

// ImageKit Routes
router.get('/imagekit/auth', authMiddleware, getImageKitAuthParamsController);
router.post('/imagekit/complete', authMiddleware, completeImageKitUploadController);

// Bunny Stream & Storage Routes
router.post('/video-slot', authMiddleware, createVideoSlotController);
router.delete('/video-slot/:videoId', authMiddleware, deleteVideoSlotController);
router.post('/upload-signature', authMiddleware, getUploadSignatureController);
router.post('/storage/complete', authMiddleware, completeBunnyStorageUploadController);
router.delete('/storage/:storageKey', authMiddleware, deleteStorageFileController);
router.get('/signed-player-url/:videoId', authMiddleware, getSignedPlayerUrlController);

export const uploadRouter = router;