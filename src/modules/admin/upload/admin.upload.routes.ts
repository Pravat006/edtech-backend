import { Router } from "express";
import { verifyAdmin } from "@/middlewares/verifyAdmin";
import {
    getImageKitAuthParamsController,
    completeImageKitUploadController
} from "@/modules/upload/upload.controller";

const router = Router();

// ImageKit Direct Upload Routes for Admins
router.get("/imagekit/auth", verifyAdmin, getImageKitAuthParamsController);
router.post("/imagekit/complete", verifyAdmin, completeImageKitUploadController);

export default router;
