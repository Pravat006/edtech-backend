import { Router } from "express";
import * as userController from "./user.controller";
import { authenticateUser } from "@/middlewares/auth.middleware";
import { validateRequest } from "@/middlewares/validateRequest";
import { UpdateProfileSchema, UpdatePreferencesSchema } from "./user.schema";

const router = Router();

// Protect all routes in this module
router.use(authenticateUser);

router.get("/profile", userController.getProfile);
router.put("/profile", validateRequest(UpdateProfileSchema), userController.updateProfile);

router.get("/preferences", userController.getPreferences);
router.put("/preferences", validateRequest(UpdatePreferencesSchema), userController.updatePreferences);

router.get("/wallet", userController.getWallet);
router.get("/referrals", userController.getReferrals);

export default router;
