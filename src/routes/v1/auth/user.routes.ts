import { userAuth } from "@/modules/auth/auth.controller";
import { authenticateUser } from "@/middlewares/auth.middleware";
import { Router } from "express";

const router = Router();

router.post("/otp/send", userAuth.sendOtp);
router.post("/otp/verify", userAuth.verifyOtp);
router.post("/profile", authenticateUser, userAuth.setupProfile);
router.post("/token/refresh", userAuth.refreshTokens);
router.post("/logout", userAuth.logout);

export default router;
