import { Router } from "express";
import { userAuth } from "./auth.controller";
import { authenticateUser } from "@/middlewares/auth.middleware";
import { authEndpointLimiter } from "@/middleware/rateLimiter";
import { validateRequest } from "@/middlewares/validateRequest";
import {
    SendOtpSchema,
    VerifyOtpSchema,
    SetPasswordSchema,
    LoginSchema,
    ChangePasswordSchema,
    ProfileSetupSchema,
    RefreshTokenSchema
} from "./auth.schema";

const router = Router();
const userRouter = Router();

userRouter.post("/check", authEndpointLimiter, userAuth.checkUserExists);
userRouter.post("/otp/send", authEndpointLimiter, validateRequest(SendOtpSchema), userAuth.sendOtp);
userRouter.post("/otp/verify", authEndpointLimiter, validateRequest(VerifyOtpSchema), userAuth.verifyOtp);
userRouter.post("/set-password", authEndpointLimiter, validateRequest(SetPasswordSchema), userAuth.setPassword);
userRouter.post("/forgot-password", authEndpointLimiter, validateRequest(SetPasswordSchema), userAuth.setPassword);
userRouter.post("/login", authEndpointLimiter, validateRequest(LoginSchema), userAuth.login);
userRouter.post("/change-password", authenticateUser, validateRequest(ChangePasswordSchema), userAuth.changePassword);
userRouter.post("/profile", authenticateUser, validateRequest(ProfileSetupSchema), userAuth.setupProfile);
userRouter.post("/token/refresh", validateRequest(RefreshTokenSchema), userAuth.refreshTokens);
userRouter.post("/logout", validateRequest(RefreshTokenSchema), userAuth.logout);

router.use("/user", userRouter);

export default router;
