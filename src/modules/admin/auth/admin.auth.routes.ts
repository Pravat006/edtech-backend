import { Router } from "express";
import { validateRequest } from "@/middlewares/validateRequest";
import { verifyAdmin, requireSuperAdmin } from "@/middlewares/verifyAdmin";
import { AdminLoginSchema, AdminAcceptInviteSchema } from "./admin.auth.schema";
import * as authController from "./admin.auth.controller";

const router = Router();

router.post("/login", validateRequest(AdminLoginSchema), authController.login);
router.post("/accept-invite", validateRequest(AdminAcceptInviteSchema), authController.acceptInvite);
router.post("/refresh", authController.refreshTokens);
router.post("/logout", authController.logout);
router.get("/me", verifyAdmin, authController.getMe);

// Super Admin Profile Management
router.post("/change-password", verifyAdmin, requireSuperAdmin, authController.changePassword);
router.post("/change-email/initiate", verifyAdmin, requireSuperAdmin, authController.initiateEmailChange);
router.post("/change-email/verify", verifyAdmin, requireSuperAdmin, authController.verifyEmailChange);

export default router;
