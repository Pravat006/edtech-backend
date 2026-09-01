import { Router } from "express";
import * as legalController from "./legal.controller";
import { authenticateUser } from "@/middlewares/auth.middleware";

const router = Router();

// Protect all legal routes with authentication
router.use(authenticateUser);

router.get("/consent-status", legalController.getConsentStatus);
router.post("/consent", legalController.recordConsent);

export default router;
