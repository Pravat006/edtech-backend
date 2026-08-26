import { Router } from "express";
import { authenticateUser } from "@/middlewares/auth.middleware";
import { referralController } from "./referral.controller";

const router = Router();

router.get("/me", authenticateUser, referralController.getDashboard);
router.post("/validate", referralController.validateCode);
router.post("/apply", authenticateUser, referralController.applyCode);

export const referralRoutes = router;
