import { Router } from "express";
import authRoutes from "./auth/admin.auth.routes";
import managementRoutes from "./management/admin.management.routes";
import adminCourseRoutes from "../courses/admin-course.routes";
import adminEnrollmentRoutes from "../enrollments/admin-enrollment.routes";
import adminUploadRoutes from "./upload/admin.upload.routes";
import { uploadRouter } from "../upload/upload.route";
import adminUserRoutes from "./users/admin.user.routes";
import adminSupportRoutes from "./support/admin.support.routes";
import { adminReferralRoutes } from "./referral/admin.referral.routes";
import adminCmsRoutes from "./cms/admin.cms.routes";
import { adminBannerRouter } from "../banner/banner.routes";
import adminAIChatRoutes from "./ai-chat/admin-ai-chat.routes";

import { verifyAdmin, requirePermission } from "@/middlewares/verifyAdmin";
import { validateRequest } from "@/middlewares/validateRequest";
import { ReviewDocumentVerificationSchema } from "../profile/profile.schema";
import * as profileController from "../profile/profile.controller";

const router = Router();

router.use("/auth", authRoutes);
router.use("/sub-admins", managementRoutes);
router.use("/management/sub-admins", managementRoutes);
router.use("/courses", adminCourseRoutes);
router.use("/enrollments", adminEnrollmentRoutes);
router.use("/upload", adminUploadRoutes);
router.use("/upload", uploadRouter);
router.use("/media", uploadRouter);
router.use("/users", adminUserRoutes);
router.use("/support", adminSupportRoutes);
router.use("/referrals", adminReferralRoutes);
router.use("/content", adminCmsRoutes);
router.use("/content", adminBannerRouter);
router.use("/ai-chat", adminAIChatRoutes);

router.get(
    "/verifications/pending",
    verifyAdmin,
    requirePermission("verifications:read"),
    profileController.getPendingVerifications
);

router.patch(
    "/verifications/review",
    verifyAdmin,
    requirePermission("verifications:write"),
    validateRequest(ReviewDocumentVerificationSchema),
    profileController.reviewDocumentVerification
);

export default router;
