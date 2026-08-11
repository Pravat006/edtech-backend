import { userAuth } from "@/modules/auth/auth.controller";
import { Router } from "express";

const router = Router();

router.post("/login", userAuth.login);
router.post("/register/verify", userAuth.verifyRegistration);
router.post("/register", userAuth.initRegister);
router.post("/otp", userAuth.resendOtpToMail);
router.post("/password/forgot", userAuth.forgotPassword);
router.post("/password/reset", userAuth.resetPassword);
router.post("/token/refresh", userAuth.refreshTokens);

export default router;
