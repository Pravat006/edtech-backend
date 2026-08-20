import { Router } from "express";
import { validateRequest } from "@/middlewares/validateRequest";
import { verifyAdmin } from "@/middlewares/verifyAdmin";
import { AdminLoginSchema, AdminAcceptInviteSchema } from "./admin.auth.schema";
import * as authController from "./admin.auth.controller";

const router = Router();

router.post("/login", validateRequest(AdminLoginSchema), authController.login);
router.post("/accept-invite", validateRequest(AdminAcceptInviteSchema), authController.acceptInvite);
router.post("/refresh", authController.refreshTokens);
router.post("/logout", authController.logout);
router.get("/me", verifyAdmin, authController.getMe);

export default router;
