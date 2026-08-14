import { Router } from "express";
import authRoutes from "./auth/admin.auth.routes";
import managementRoutes from "./management/admin.management.routes";

const router = Router();

router.use("/auth", authRoutes);
router.use("/sub-admins", managementRoutes);

// Course Management routes will go here
// Moderation routes will go here

export default router;
