import { Request, Response } from "express";
import httpStatus from "http-status";
import { enrollmentService } from "./enrollment.service";
import { EnrollmentQuery } from "./enrollment.schema";

/**
 * GET /v1/enrollments
 * Get a paginated list of the current user's enrollments.
 */
export const getUserEnrollments = async (req: Request, res: Response) => {
    const userId = req.user!.id;
    const query = req.query as unknown as EnrollmentQuery;

    const result = await enrollmentService.getUserEnrollments(userId, query);

    res.status(httpStatus.OK).json({
        success: true,
        data: result,
    });
};

/**
 * GET /v1/enrollments/:enrollmentId
 * Get detailed information about a specific enrollment (includes payment info).
 */
export const getUserEnrollmentDetails = async (req: Request, res: Response) => {
    const userId = req.user!.id;
    const { enrollmentId } = req.params;

    const result = await enrollmentService.getUserEnrollmentDetails(userId, enrollmentId);

    res.status(httpStatus.OK).json({
        success: true,
        data: result,
    });
};
