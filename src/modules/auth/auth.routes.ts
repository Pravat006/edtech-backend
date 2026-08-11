import { Router } from "express";
import { adminAuth, userAuth } from "./auth.controller";

const router = Router();
const userRouter = Router();
const adminRouter = Router();

userRouter.post("/login", userAuth.login);
userRouter.post("/register/verify", userAuth.verifyRegistration);
userRouter.post("/register", userAuth.initRegister);
userRouter.post("/otp", userAuth.resendOtpToMail);
userRouter.post("/password/forgot", userAuth.forgotPassword);
userRouter.post("/password/reset", userAuth.resetPassword);
userRouter.post("/token/refresh", userAuth.refreshTokens);

adminRouter.post("/login", adminAuth.login);
adminRouter.post("/login/verify", adminAuth.verifyLogin);

router.use("/user", userRouter);
router.use("/admin", adminRouter);

export default router;

