import { Router } from "express";
import * as userController from "./user.controller";
import { authenticateUser, optionalAuthenticateUser } from "@/middlewares/auth.middleware";
import { validateRequest } from "@/middlewares/validateRequest";
import {
    UpdateProfileSchema,
    UpdatePreferencesSchema,
    RequestPhoneChangeSchema,
    VerifyPhoneChangeSchema,
    RequestEmailChangeSchema,
    VerifyEmailChangeSchema,
    InitiateAccountDeletionSchema,
    ConfirmAccountDeletionSchema,
} from "./user.schema";

const router = Router();

// 2-Step Verified Self Account Deletion (Supports unauthenticated public web requests + authenticated user sessions)
router.post("/delete-account/request", optionalAuthenticateUser, validateRequest(InitiateAccountDeletionSchema), userController.initiateAccountDeletion);
router.post("/delete-account/confirm", optionalAuthenticateUser, validateRequest(ConfirmAccountDeletionSchema), userController.confirmAccountDeletion);

// Protect remaining authenticated user routes
router.use(authenticateUser);

router.get("/profile", userController.getProfile);
router.put("/profile", validateRequest(UpdateProfileSchema), userController.updateProfile);
router.patch("/profile", validateRequest(UpdateProfileSchema), userController.updateProfile);
router.delete("/profile", userController.deleteMyAccount);
router.delete("/me", userController.deleteMyAccount);

router.get("/export", userController.exportUserData);

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

