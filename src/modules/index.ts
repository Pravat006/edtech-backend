import { Router } from "express";
import adminRoutes from "./admin/admin.routes";
import authRoutes from "./auth/auth.routes";
import courseRoutes from "./courses/course.routes";
import enrollmentRoutes from "./enrollments/enrollment.routes";
import paymentRoutes from "./payments/payment.routes";
import publicRoutes from "./public/public.routes";
import userRoutes from "./users/user.routes";

const router = Router();

// User Flow Routes
router.use("/auth", authRoutes);
router.use("/user", userRoutes);

// Admin Flow Routes
router.use("/admin", adminRoutes);

router.use("/public", publicRoutes);
router.use("/courses", courseRoutes);
router.use("/enrollments", enrollmentRoutes);
router.use("/payments", paymentRoutes);

export default router;

