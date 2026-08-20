import { Router } from "express";
import authRoutes from "./auth/admin.auth.routes";
import managementRoutes from "./management/admin.management.routes";
import adminCourseRoutes from "../courses/admin-course.routes";
import adminEnrollmentRoutes from "../enrollments/admin-enrollment.routes";
import adminUploadRoutes from "./upload/admin.upload.routes";

import { verifyAdmin, requirePermission } from "@/middlewares/verifyAdmin";
import { validateRequest } from "@/middlewares/validateRequest";
import { ReviewDocumentVerificationSchema } from "../profile/profile.schema";
import * as profileController from "../profile/profile.controller";

const router = Router();

router.use("/auth", authRoutes);
router.use("/sub-admins", managementRoutes);
router.use("/courses", adminCourseRoutes);
router.use("/enrollments", adminEnrollmentRoutes);
router.use("/upload", adminUploadRoutes);

router.patch(
    "/verifications/review",
    verifyAdmin,
    requirePermission("verifications:write"),
    validateRequest(ReviewDocumentVerificationSchema),
    profileController.reviewDocumentVerification
);

export default router;
