import { Router } from "express";
import adminRoutes from "./admin/admin.routes";
import authRoutes from "./auth/auth.routes";
import courseRoutes from "./courses/course.routes";
import enrollmentRoutes from "./enrollments/enrollment.routes";
import paymentRoutes from "./payments/payment.routes";
import profileRoutes from "./profile/profile.routes";
import publicRoutes from "./public/public.routes";
import { uploadRouter } from "./upload/upload.route";
import supportRoutes from "./support/support.routes";
import userRoutes from "./users/user.routes";
import wishlistRoutes from "./wishlist/wishlist.routes";
import { referralRoutes } from "./referral/referral.routes";
import { communityRoutes } from "./community/community.routes";
import cmsRoutes from "./content/cms.routes";
import { publicBannerRouter } from "./banner/banner.routes";
import aiChatRoutes from "./ai-chat/ai-chat.routes";

const router = Router();

// User Flow Routes
router.use("/auth", authRoutes);
router.use("/user", userRoutes);

// Admin Flow Routes
router.use("/admin", adminRoutes);

router.use("/content", cmsRoutes);
router.use("/content", publicBannerRouter);
router.use("/public", publicRoutes);
router.use("/courses", courseRoutes);
router.use("/enrollments", enrollmentRoutes);
router.use("/payments", paymentRoutes);
router.use("/profile", profileRoutes);
router.use("/support", supportRoutes);
router.use("/wishlist", wishlistRoutes);
router.use("/upload", uploadRouter);
router.use("/referrals", referralRoutes);
router.use("/community", communityRoutes);
router.use("/ai-chat", aiChatRoutes);

export default router;

