import { Router } from "express";
import { authenticateUser } from "@/middlewares/auth.middleware";
import { catchAsync } from "@/utils/catchAsync";
import { referralController } from "./referral.controller";

const router = Router();

router.get("/me", authenticateUser, catchAsync(referralController.getDashboard));
router.post("/validate", catchAsync(referralController.validateCode));
router.post("/apply", authenticateUser, catchAsync(referralController.applyCode));

export const referralRoutes = router;
