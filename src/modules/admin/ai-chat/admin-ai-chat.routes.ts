import { Router } from "express";
import { authenticateAdmin, authorizeSuperAdmin } from "@/middlewares/admin.middleware";
import { adminAIChatController } from "./admin-ai-chat.controller";

const router = Router();

// All admin AI chat routes require admin authentication
router.use(authenticateAdmin);

// Analytics & List Packages: Accessible by ADMIN and SUPER_ADMIN
router.get("/packages", adminAIChatController.getAllPackages);
router.get("/analytics", adminAIChatController.getAnalytics);

// Package CRUD & Manual Credit Grants: Restricted STRICTLY to SUPER_ADMIN
router.post("/packages", authorizeSuperAdmin, adminAIChatController.createPackage);
router.put("/packages/:id", authorizeSuperAdmin, adminAIChatController.updatePackage);
router.patch("/packages/:id/toggle", authorizeSuperAdmin, adminAIChatController.togglePackageStatus);
router.delete("/packages/:id", authorizeSuperAdmin, adminAIChatController.deletePackage);
router.post("/wallets/grant", authorizeSuperAdmin, adminAIChatController.grantPromotionalCredits);

export default router;
