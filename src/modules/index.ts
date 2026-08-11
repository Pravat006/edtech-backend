import { Router } from "express";
import adminRoutes from "./admin/admin.routes";
import authRoutes from "./auth/auth.routes";
import courseRoutes from "./courses/course.routes";
import enrollmentRoutes from "./enrollments/enrollment.routes";
import paymentRoutes from "./payments/payment.routes";
import publicRoutes from "./public/public.routes";
import userRoutes from "./users/user.routes";

const router = Router();

router.use("/auth", authRoutes);
router.use("/user", userRoutes);
router.use("/public", publicRoutes);
router.use("/admin", adminRoutes);
router.use("/courses", courseRoutes);
router.use("/enrollments", enrollmentRoutes);
router.use("/payments", paymentRoutes);

export default router;

