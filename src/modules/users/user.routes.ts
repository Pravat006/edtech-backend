import { Router } from "express";
import * as userController from "./user.controller";
import { authenticateUser } from "@/middlewares/auth.middleware";
import { validateRequest } from "@/middlewares/validateRequest";
import {
    UpdateProfileSchema,
    UpdatePreferencesSchema,
    RequestPhoneChangeSchema,
    VerifyPhoneChangeSchema,
    RequestEmailChangeSchema,
    VerifyEmailChangeSchema,
} from "./user.schema";

const router = Router();

// Protect all routes in this module
router.use(authenticateUser);

router.get("/profile", userController.getProfile);
router.put("/profile", validateRequest(UpdateProfileSchema), userController.updateProfile);
router.patch("/profile", validateRequest(UpdateProfileSchema), userController.updateProfile);

router.get("/preferences", userController.getPreferences);
router.put("/preferences", validateRequest(UpdatePreferencesSchema), userController.updatePreferences);

router.get("/wallet", userController.getWallet);
router.get("/referrals", userController.getReferrals);
router.patch("/push-token", userController.updatePushToken);

// Phone Number Change with SMS OTP
router.post("/change-phone/request", validateRequest(RequestPhoneChangeSchema), userController.requestPhoneChange);
router.post("/change-phone/verify", validateRequest(VerifyPhoneChangeSchema), userController.verifyPhoneChange);

// Email Change / Verification with Email OTP
router.post("/change-email/request", validateRequest(RequestEmailChangeSchema), userController.requestEmailChange);
router.post("/change-email/verify", validateRequest(VerifyEmailChangeSchema), userController.verifyEmailChange);

export default router;

