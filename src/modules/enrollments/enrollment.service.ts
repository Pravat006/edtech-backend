import { db } from "@/config/db";
import { APIError } from "@/utils/APIError";
import httpStatus from "http-status";
import { EnrollmentQuery } from "./enrollment.schema";


class EnrollmentService {
    /**
     * GET /v1/enrollments
     * Fetch paginated list of enrollments for the authenticated user.
     */
    public async getUserEnrollments(userId: string, query: EnrollmentQuery) {
        const { status, limit, cursor } = query;

        const where: any = {
            userId,
            ...(status && { status }),
        };

        const enrollments = await db.enrollment.findMany({
            where,
            take: limit + 1, // Fetch 1 extra to determine if there is a next page
            ...(cursor && {
                skip: 1,
                cursor: { id: cursor },
            }),
            orderBy: {
                enrolledAt: "desc",
            },
            include: {
                course: {
                    select: {
                        id: true,
                        title: true,
                        thumbnail: true,
                        instructor: { select: { name: true } },
                    },
                },
            },
        });

        let nextCursor: string | undefined = undefined;
        if (enrollments.length > limit) {
            const nextItem = enrollments.pop();
            nextCursor = nextItem?.id;
        }

        return {
            items: enrollments,
            nextCursor,
        };
    }

    /**
     * GET /v1/enrollments/:enrollmentId
     * Fetch detailed enrollment information including payment history for invoices.
     */
    public async getUserEnrollmentDetails(userId: string, enrollmentId: string) {
        const enrollment = await db.enrollment.findUnique({
            where: {
                id: enrollmentId,
                userId,
            },
            include: {
                course: {
                    select: {
                        id: true,
                        title: true,
                        description: true,
                        thumbnail: true,
                        price: true,
                        isFree: true,
                        instructor: { select: { name: true, email: true } },
                    },
                },
                payment: {
                    include: {
                        transactions: {
                            orderBy: { createdAt: 'desc' }
                        }
                    }
                },
                certificate: true,
            },
        });

        if (!enrollment) {
            throw new APIError(httpStatus.NOT_FOUND, "Enrollment not found");
        }

        return enrollment;
    }
}

export const enrollmentService = new EnrollmentService();
