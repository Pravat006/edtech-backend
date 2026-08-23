import { Router } from "express";
import { validateRequest } from "@/middlewares/validateRequest";
import { authenticateAdmin, authorizeSuperAdmin } from "@/middlewares/admin.middleware";
import * as adminEnrollmentController from "./admin-enrollment.controller";
import { AdminEnrollmentQuerySchema, RevokeEnrollmentSchema } from "./enrollment.schema";

const router = Router();

router.use(authenticateAdmin);

// Dashboard listing
router.get(
    "/",
    validateRequest(AdminEnrollmentQuerySchema, "query"),
    adminEnrollmentController.getAdminEnrollments
);

// Revocation/Refund (Super Admin Only to protect financial loss)
router.patch(
    "/:enrollmentId/revoke",
    authorizeSuperAdmin,
    validateRequest(RevokeEnrollmentSchema),
    adminEnrollmentController.revokeEnrollment
);

export default router;
