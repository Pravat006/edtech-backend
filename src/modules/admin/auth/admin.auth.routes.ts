import { Router } from "express";
import { validateRequest } from "@/middlewares/validateRequest";
import { AdminLoginSchema } from "./admin.auth.schema";
import * as authController from "./admin.auth.controller";

const router = Router();

router.post("/login", validateRequest(AdminLoginSchema), authController.login);
router.post("/refresh", authController.refreshTokens);
router.post("/logout", authController.logout);

export default router;
