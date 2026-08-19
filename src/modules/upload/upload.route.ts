import { Router } from "express";
import {
    abortUploadController, completeMultiPartUpload, initiateUploadController, getMultipartUrlsController, getImageKitAuthParamsController, completeImageKitUploadController
} from "./upload.controller";
import { authenticateUser } from "@/middlewares/auth.middleware";

const router = Router();

router.post('/initiate', authenticateUser, initiateUploadController);
router.post('/complete', authenticateUser, completeMultiPartUpload);
router.post('/abort', authenticateUser, abortUploadController);
router.post('/get-multipart-urls', authenticateUser, getMultipartUrlsController);

// ImageKit Routes
router.get('/imagekit/auth', authenticateUser, getImageKitAuthParamsController);
router.post('/imagekit/complete', authenticateUser, completeImageKitUploadController);

export const uploadRouter = router;