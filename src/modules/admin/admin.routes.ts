import { Router } from "express";
import authRoutes from "./auth/admin.auth.routes";
import managementRoutes from "./management/admin.management.routes";
import adminCourseRoutes from "../courses/admin-course.routes";
import adminEnrollmentRoutes from "../enrollments/admin-enrollment.routes";

const router = Router();

router.use("/auth", authRoutes);
router.use("/sub-admins", managementRoutes);
router.use("/courses", adminCourseRoutes);
router.use("/enrollments", adminEnrollmentRoutes);

export default router;
