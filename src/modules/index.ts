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
import { publicSettingsRouter } from "./settings/settings.routes";
import { calendarRouter } from "./calendar/calendar.routes";
import legalRouter from "./legal/legal.routes";
import { publicRateLimiter, authenticatedRateLimiter } from "@/middleware/rateLimiter";

const router = Router();

// User Flow Routes
router.use("/auth", authRoutes); // authRoutes has authEndpointLimiter internally
router.use("/user", authenticatedRateLimiter, userRoutes);

// Admin Flow Routes
router.use("/admin", adminRoutes);

// Public & Content Routes (Public Rate Limit)
router.use("/content", publicRateLimiter, cmsRoutes);
router.use("/content", publicRateLimiter, publicBannerRouter);
router.use("/public/settings", publicRateLimiter, publicSettingsRouter);
router.use("/public/calendar", publicRateLimiter, calendarRouter);
router.use("/public", publicRateLimiter, publicRoutes);
router.use("/courses", publicRateLimiter, courseRoutes); // Courses has both public/private, but mostly public discovery
router.use("/upload", publicRateLimiter, uploadRouter);
router.use("/media", publicRateLimiter, uploadRouter);

// Authenticated Routes (Looser Rate Limit)
router.use("/enrollments", authenticatedRateLimiter, enrollmentRoutes);
router.use("/payments", authenticatedRateLimiter, paymentRoutes);
router.use("/profile", authenticatedRateLimiter, profileRoutes);
router.use("/support", authenticatedRateLimiter, supportRoutes);
router.use("/wishlist", authenticatedRateLimiter, wishlistRoutes);
router.use("/referrals", authenticatedRateLimiter, referralRoutes);
router.use("/community", authenticatedRateLimiter, communityRoutes);
router.use("/ai-chat", authenticatedRateLimiter, aiChatRoutes);
router.use("/legal", authenticatedRateLimiter, legalRouter);

export default router;

