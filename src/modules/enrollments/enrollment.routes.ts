import { Router } from "express";
import { validateRequest } from "@/middlewares/validateRequest";
import { authenticateUser } from "@/middlewares/auth.middleware";
import * as enrollmentController from "./enrollment.controller";
import { EnrollmentQuerySchema } from "./enrollment.schema";

const router = Router();

// ─── User Facing Routes (Requires Authentication) ─────────────────────────────

router.use(authenticateUser);

router.get(
    "/",
    validateRequest(EnrollmentQuerySchema),
    enrollmentController.getUserEnrollments
);

router.get(
    "/:enrollmentId",
    enrollmentController.getUserEnrollmentDetails
);

export default router;
