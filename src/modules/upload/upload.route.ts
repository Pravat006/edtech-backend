import { Router } from "express";
import {
    abortUploadController, completeMultiPartUpload, initiateUploadController, getMultipartUrlsController
} from "./upload.controller";
import { authenticateUser } from "@/middlewares/auth.middleware";

const router = Router();

router.post('/initiate', authenticateUser, initiateUploadController);
router.post('/complete', authenticateUser, completeMultiPartUpload);
router.post('/abort', authenticateUser, abortUploadController);
router.post('/get-multipart-urls', authenticateUser, getMultipartUrlsController);

export const uploadRouter = router;