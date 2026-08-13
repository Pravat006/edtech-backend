import { Router } from "express";
import { userAuth } from "./auth.controller";
import { authenticateUser } from "@/middlewares/auth.middleware";

const router = Router();
const userRouter = Router();

userRouter.post("/otp/send", userAuth.sendOtp);
userRouter.post("/otp/verify", userAuth.verifyOtp);
userRouter.post("/profile", authenticateUser, userAuth.setupProfile);
userRouter.post("/token/refresh", userAuth.refreshTokens);
userRouter.post("/logout", userAuth.logout);

router.use("/user", userRouter);

export default router;
