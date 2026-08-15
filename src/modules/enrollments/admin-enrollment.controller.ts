import { Request, Response } from "express";
import httpStatus from "http-status";
import { adminEnrollmentService } from "./admin-enrollment.service";
import { AdminEnrollmentQuery, RevokeEnrollment } from "./enrollment.schema";

/**
 * GET /v1/admin/enrollments
 * Get a paginated list of all enrollments with admin filters.
 */
export const getAdminEnrollments = async (req: Request, res: Response) => {
    const query = req.query as unknown as AdminEnrollmentQuery;
    const result = await adminEnrollmentService.getAdminEnrollments(query);

    res.status(httpStatus.OK).json({
        success: true,
        data: result,
    });
};

/**
 * PATCH /v1/admin/enrollments/:enrollmentId/revoke
 * Revokes a user's enrollment and optionally processes a refund.
 */
export const revokeEnrollment = async (req: Request, res: Response) => {
    const { enrollmentId } = req.params;
    const adminId = req.admin!.id;
    const data = req.body as RevokeEnrollment;

    const result = await adminEnrollmentService.revokeEnrollment(enrollmentId, adminId, data);

    res.status(httpStatus.OK).json({
        success: true,
        message: data.refund ? "Enrollment refunded and revoked" : "Enrollment revoked",
        data: result,
    });
};
