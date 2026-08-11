import { adminAuth } from "@/modules/auth/auth.controller";
import { Router } from "express";

const router = Router();

router.post("/login", adminAuth.login);
router.post("/login/verify", adminAuth.verifyLogin);

export default router;
