import { Router } from "express";
import authRoutes from "./auth";
import userRoutes from "./user";
import publicRoutes from "./public";
import adminRoutes from "./admin";
import { uploadRouter } from "@/modules/upload/upload.route";

const router = Router();

router.use("/auth", authRoutes);
router.use("/user", userRoutes);
router.use("/public", publicRoutes);
router.use("/admin", adminRoutes);
router.use("/upload", uploadRouter);

export default router;
