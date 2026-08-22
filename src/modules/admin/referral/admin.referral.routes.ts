import { Router } from "express";
import { authenticateAdmin } from "@/middlewares/admin.middleware";
import { catchAsync } from "@/utils/catchAsync";
import { adminReferralController } from "./admin.referral.controller";

const router = Router();

// Protect all admin referral routes
router.use(authenticateAdmin);

router.get("/stats", catchAsync(adminReferralController.getStats));
router.get("/list", catchAsync(adminReferralController.getReferrals));
router.get("/config", catchAsync(adminReferralController.getConfig));
router.patch("/config", catchAsync(adminReferralController.updateConfig));
router.post("/:referralId/override", catchAsync(adminReferralController.overrideReward));

export const adminReferralRoutes = router;
