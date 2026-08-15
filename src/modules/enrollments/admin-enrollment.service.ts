import { db } from "@/config/db";
import { APIError } from "@/utils/APIError";
import httpStatus from "http-status";
import { AdminEnrollmentQuery, RevokeEnrollment } from "./enrollment.schema";
import { razorpayService } from "@/services/razorpay.service";

class AdminEnrollmentService {
    /**
     * GET /v1/admin/enrollments
     * Fetch list of enrollments for admin dashboard with filters.
     */
    public async getAdminEnrollments(query: AdminEnrollmentQuery) {
        const { status, courseId, userId, search, limit, cursor } = query;

        const where: any = {
            ...(status && { status }),
            ...(courseId && { courseId }),
            ...(userId && { userId }),
            ...(search && {
                user: {
                    OR: [
                        { name: { contains: search, mode: "insensitive" } },
                        { email: { contains: search, mode: "insensitive" } },
                        { phoneNumber: { contains: search, mode: "insensitive" } },
                    ]
                }
            }),
        };

        const enrollments = await db.enrollment.findMany({
            where,
            take: limit + 1,
            ...(cursor && {
                skip: 1,
                cursor: { id: cursor },
            }),
            orderBy: { enrolledAt: "desc" },
            include: {
                user: { select: { id: true, name: true, email: true, phoneNumber: true } },
                course: { select: { id: true, title: true, price: true } },
                payment: { select: { id: true, status: true, provider: true, amount: true } },
            },
        });

        let nextCursor: string | undefined = undefined;
        if (enrollments.length > limit) {
            const nextItem = enrollments.pop();
            nextCursor = nextItem?.id;
        }

        const totalCount = await db.enrollment.count({ where });

        return {
            items: enrollments,
            nextCursor,
            totalCount,
        };
    }

    /**
     * PATCH /v1/admin/enrollments/:enrollmentId/revoke
     * Revokes a user's enrollment and optionally processes a refund.
     */
    public async revokeEnrollment(enrollmentId: string, adminId: string, data: RevokeEnrollment) {
        const { reason, refund } = data;

        const enrollment = await db.enrollment.findUnique({
            where: { id: enrollmentId },
            include: { payment: true, certificate: true },
        });

        if (!enrollment) {
            throw new APIError(httpStatus.NOT_FOUND, "Enrollment not found");
        }

        if (enrollment.status === "CANCELLED" || enrollment.status === "REFUNDED") {
            throw new APIError(httpStatus.BAD_REQUEST, `Enrollment is already ${enrollment.status}`);
        }

        return await db.$transaction(async (tx) => {
            let finalStatus = "CANCELLED";

            // Process Refund if requested and a payment exists
            if (refund && enrollment.payment && enrollment.payment.status === "SUCCESS") {
                const payment = enrollment.payment;

                if (payment.provider === "RAZORPAY" && payment.providerOrderId) {
                    // Fetch all payments for this order from Razorpay
                    const rzpPayments = await razorpayService.fetchOrderPayments(payment.providerOrderId);
                    
                    // Find the successful payment capture
                    const successfulCapture = rzpPayments.find(p => p.status === "captured");
                    
                    if (!successfulCapture) {
                        throw new APIError(httpStatus.BAD_REQUEST, "Could not find a captured Razorpay payment for this order to refund");
                    }

                    // Issue refund via Razorpay API
                    await razorpayService.createRefund(
                        successfulCapture.id, 
                        undefined, // full refund
                        { reason, revokedByAdminId: adminId }
                    );
                }

                // Update DB Payment Status
                await tx.payment.update({
                    where: { id: enrollment.payment.id },
                    data: { status: "REFUNDED" },
                });

                // Create Audit Transaction
                await tx.transaction.create({
                    data: {
                        userId: enrollment.userId,
                        paymentId: enrollment.payment.id,
                        type: "REFUND",
                        status: "SUCCESS",
                        amount: enrollment.payment.amount,
                        currency: enrollment.payment.currency,
                        failureReason: `Admin Revoke: ${reason}`,
                    },
                });

                finalStatus = "REFUNDED";
            }

            // Revoke Certificate if one was issued
            if (enrollment.certificate) {
                await tx.certificate.delete({
                    where: { id: enrollment.certificate.id },
                });
            }

            // Revoke Enrollment Access
            const revokedEnrollment = await tx.enrollment.update({
                where: { id: enrollment.id },
                data: { status: finalStatus as any },
            });

            return revokedEnrollment;
        });
    }
}

export const adminEnrollmentService = new AdminEnrollmentService();
