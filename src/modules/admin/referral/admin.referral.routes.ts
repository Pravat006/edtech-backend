import { Router } from "express";
import { authenticateAdmin } from "@/middlewares/admin.middleware";
import { adminReferralController } from "./admin.referral.controller";

const router = Router();

// Protect all admin referral routes
router.use(authenticateAdmin);

router.get("/stats", adminReferralController.getStats);
router.get("/list", adminReferralController.getReferrals);
router.get("/config", adminReferralController.getConfig);
router.patch("/config", adminReferralController.updateConfig);
router.post("/:referralId/override", adminReferralController.overrideReward);

export const adminReferralRoutes = router;
