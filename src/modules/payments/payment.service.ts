import { db } from "@/config/db";
import { APIError } from "@/utils/APIError";
import httpStatus from "http-status";
import { razorpayService } from "@/services/razorpay.service";
import envVars from "@/config/envVars";
import { logger } from "@/config/logger";

class PaymentService {
    /**
     * POST /v1/payments/checkout/initiate
     * Initiates a checkout process for a course.
     * Handles both Free and Paid courses.
     */
    public async initiateCheckout(userId: string, courseId: string) {
        // 1. Validate course
        const course = await db.course.findUnique({
            where: { id: courseId },
        });

        if (!course) {
            throw new APIError(httpStatus.NOT_FOUND, "Course not found");
        }

        if (!course.isPublished) {
            throw new APIError(httpStatus.BAD_REQUEST, "Course is not available for enrollment");
        }

        // 2. Check existing enrollment
        const existingEnrollment = await db.enrollment.findUnique({
            where: {
                userId_courseId: {
                    userId,
                    courseId,
                },
            },
        });

        if (existingEnrollment) {
            if (existingEnrollment.status === "ACTIVE" || existingEnrollment.status === "COMPLETED") {
                throw new APIError(httpStatus.BAD_REQUEST, "You are already actively enrolled in this course");
            }
        }

        // 3. Calculate final price (MVP: no coupons)
        const finalPrice = course.isFree ? 0 : Number(course.price || 0);

        // 4. Free Course Pathway (Instant Access via Transaction)
        if (finalPrice === 0) {
            const enrollment = await db.$transaction(async (tx) => {
                // Calculate expiration
                const expiresAt = course.accessDurationDays
                    ? new Date(Date.now() + course.accessDurationDays * 86400000)
                    : null;

                // Create a $0 SUCCESS Payment
                const payment = await tx.payment.create({
                    data: {
                        userId,
                        provider: "RAZORPAY", // or could be a dummy 'FREE_GRANT' if enum allowed
                        amount: 0,
                        currency: "INR",
                        status: "SUCCESS",
                        providerOrderId: `free_${Date.now()}`,
                    },
                });

                // Create ACTIVE Enrollment
                const newEnrollment = await tx.enrollment.upsert({
                    where: {
                        userId_courseId: { userId, courseId },
                    },
                    create: {
                        userId,
                        courseId,
                        status: "ACTIVE",
                        enrolledAt: new Date(),
                        accessDurationDays: course.accessDurationDays,
                        expiresAt,
                    },
                    update: {
                        status: "ACTIVE",
                        enrolledAt: new Date(),
                        accessDurationDays: course.accessDurationDays,
                        expiresAt,
                    },
                });

                // Connect payment to enrollment
                await tx.payment.update({
                    where: { id: payment.id },
                    data: { enrollmentId: newEnrollment.id },
                });

                // Create Audit Transaction
                await tx.transaction.create({
                    data: {
                        userId,
                        paymentId: payment.id,
                        type: "PAYMENT",
                        status: "SUCCESS",
                        amount: 0,
                        currency: "INR",
                    },
                });

                return newEnrollment;
            });

            return {
                isFree: true,
                enrollment,
            };
        }

        // 5. Paid Course Pathway (Gateway Order Initiation)
        if (!razorpayService.isConfigured()) {
            throw new APIError(httpStatus.INTERNAL_SERVER_ERROR, "Payment gateway is not configured properly");
        }

        const receiptId = `rcpt_${userId.slice(0, 8)}_${Date.now()}`;

        // Init Razorpay Order
        const rzpOrder = await razorpayService.createOrder(
            finalPrice,
            "INR",
            receiptId,
            { courseId, userId }
        );

        // Create PENDING Payment record
        const pendingPayment = await db.payment.create({
            data: {
                userId,
                provider: "RAZORPAY",
                providerOrderId: rzpOrder.id,
                amount: finalPrice,
                currency: "INR",
                status: "PENDING",
            },
        });


        return {
            isFree: false,
            orderId: rzpOrder.id,
            amount: finalPrice,
            currency: "INR",
            paymentId: pendingPayment.id,
            key: envVars.RAZORPAY_KEY_ID,
        };
    }

    /**
     * POST /v1/payments/checkout/verify
     * Verifies Razorpay payment signature and finalizes enrollment inside a transaction.
     */
    public async verifyPayment(userId: string, paymentId: string, orderId: string, signature: string) {
        return await db.$transaction(async (tx) => {
            // 1. Fetch the PENDING payment record
            const payment = await tx.payment.findFirst({
                where: { providerOrderId: orderId, userId },
                include: { user: true },
            });

            if (!payment) {
                throw new APIError(httpStatus.NOT_FOUND, "Payment record not found for this order");
            }

            // 2. Idempotency Check
            if (payment.status === "SUCCESS") {
                // Webhook might have already processed this exact millisecond
                if (payment.enrollmentId) {
                    const existingEnrollment = await tx.enrollment.findUnique({
                        where: { id: payment.enrollmentId },
                    });
                    if (existingEnrollment) return existingEnrollment;
                }
                throw new APIError(httpStatus.BAD_REQUEST, "Payment is already processed");
            }

            if (payment.status === "FAILED" || payment.status === "REFUNDED") {
                throw new APIError(httpStatus.BAD_REQUEST, `Payment cannot be processed as it is ${payment.status}`);
            }

            // 3. Verify Cryptographic Signature
            const isSignatureValid = razorpayService.verifyPaymentSignature(
                orderId,
                paymentId,
                signature
            );

            if (!isSignatureValid) {
                // Log failure and update status
                await tx.payment.update({
                    where: { id: payment.id },
                    data: { status: "FAILED" },
                });

                await tx.transaction.create({
                    data: {
                        userId,
                        paymentId: payment.id,
                        type: "PAYMENT",
                        status: "FAILED",
                        amount: payment.amount,
                        currency: payment.currency,
                        failureReason: "Invalid Signature",
                    },
                });

                throw new APIError(httpStatus.BAD_REQUEST, "Invalid payment signature");
            }

            // 4. Fetch Order from Razorpay to get courseId from notes
            const rzpOrder = await razorpayService.fetchOrder(orderId);
            const courseId = rzpOrder.notes?.courseId as string;

            if (!courseId) {
                throw new APIError(httpStatus.INTERNAL_SERVER_ERROR, "Course ID missing in Razorpay Order notes");
            }

            // 5. Fetch associated course for expiration logic
            const course = await tx.course.findUnique({
                where: { id: courseId },
            });

            if (!course) {
                throw new APIError(httpStatus.NOT_FOUND, "Associated course not found");
            }

            const expiresAt = course.accessDurationDays
                ? new Date(Date.now() + course.accessDurationDays * 86400000)
                : null;

            // 6. Update Payment to SUCCESS
            await tx.payment.update({
                where: { id: payment.id },
                data: { status: "SUCCESS" },
            });

            // 7. Upsert ACTIVE Enrollment
            const enrollment = await tx.enrollment.upsert({
                where: {
                    userId_courseId: { userId, courseId },
                },
                create: {
                    userId,
                    courseId,
                    status: "ACTIVE",
                    enrolledAt: new Date(),
                    accessDurationDays: course.accessDurationDays,
                    expiresAt,
                },
                update: {
                    status: "ACTIVE",
                    enrolledAt: new Date(),
                    accessDurationDays: course.accessDurationDays,
                    expiresAt,
                },
            });

            // 8. Link Payment to Enrollment
            await tx.payment.update({
                where: { id: payment.id },
                data: { enrollmentId: enrollment.id },
            });

            // 9. Create Audit Transaction
            await tx.transaction.create({
                data: {
                    userId,
                    paymentId: payment.id,
                    type: "PAYMENT",
                    status: "SUCCESS",
                    amount: payment.amount,
                    currency: payment.currency,
                },
            });

            return enrollment;
        });
    }

    /**
     * Webhook Handler: Handle successful payment captured
     */
    public async handlePaymentSuccessWebhook(payload: any) {
        const paymentData = payload.payment.entity;
        const orderId = paymentData.order_id;

        return await db.$transaction(async (tx) => {
            const payment = await tx.payment.findFirst({
                where: { providerOrderId: orderId },
                include: { user: true },
            });

            if (!payment) return;

            // Idempotency check
            if (payment.status === "SUCCESS") return;

            // Fetch courseId from Razorpay order notes
            const rzpOrder = await razorpayService.fetchOrder(orderId);
            const courseId = rzpOrder.notes?.courseId as string;

            if (!courseId) return;

            const course = await tx.course.findUnique({ where: { id: courseId } });
            if (!course) return;

            const expiresAt = course.accessDurationDays
                ? new Date(Date.now() + course.accessDurationDays * 86400000)
                : null;

            await tx.payment.update({
                where: { id: payment.id },
                data: { status: "SUCCESS" },
            });

            const enrollment = await tx.enrollment.upsert({
                where: { userId_courseId: { userId: payment.userId, courseId } },
                create: {
                    userId: payment.userId,
                    courseId,
                    status: "ACTIVE",
                    enrolledAt: new Date(),
                    accessDurationDays: course.accessDurationDays,
                    expiresAt,
                },
                update: {
                    status: "ACTIVE",
                    enrolledAt: new Date(),
                    accessDurationDays: course.accessDurationDays,
                    expiresAt,
                },
            });

            await tx.payment.update({
                where: { id: payment.id },
                data: { enrollmentId: enrollment.id },
            });

            await tx.transaction.create({
                data: {
                    userId: payment.userId,
                    paymentId: payment.id,
                    type: "PAYMENT",
                    status: "SUCCESS",
                    amount: payment.amount,
                    currency: payment.currency,
                },
            });
        });
    }

    /**
     * Webhook Handler: Handle failed payment
     */
    public async handlePaymentFailureWebhook(payload: any) {
        const paymentData = payload.payment.entity;
        const orderId = paymentData.order_id;
        const errorCode = paymentData.error_code;
        const errorDescription = paymentData.error_description;

        await db.$transaction(async (tx) => {
            const payment = await tx.payment.findFirst({
                where: { providerOrderId: orderId },
            });

            if (!payment || payment.status === "FAILED") return;

            await tx.payment.update({
                where: { id: payment.id },
                data: { status: "FAILED" },
            });

            await tx.transaction.create({
                data: {
                    userId: payment.userId,
                    paymentId: payment.id,
                    type: "PAYMENT",
                    status: "FAILED",
                    amount: payment.amount,
                    currency: payment.currency,
                    failureReason: `${errorCode}: ${errorDescription}`,
                },
            });
        });
    }

    /**
     * Webhook Handler: Handle refund processed
     */
    public async handleRefundWebhook(payload: any) {
        const refundData = payload.refund.entity;
        const paymentId = refundData.payment_id;

        // Fetch payment details from Razorpay to get the orderId
        const rzpPayment = await razorpayService.fetchPayment(paymentId);
        const orderId = rzpPayment.order_id;

        if (!orderId) {
            logger.error(`[WEBHOOK] Refund processed but missing order_id for payment: ${paymentId}`);
            return;
        }

        await db.$transaction(async (tx) => {
            const payment = await tx.payment.findFirst({
                where: { providerOrderId: orderId },
            });

            if (!payment || payment.status === "REFUNDED") return;

            // Update Payment status
            await tx.payment.update({
                where: { id: payment.id },
                data: { status: "REFUNDED" },
            });

            // Update Enrollment status if one exists
            if (payment.enrollmentId) {
                await tx.enrollment.update({
                    where: { id: payment.enrollmentId },
                    data: { status: "REFUNDED" },
                });
            }

            // Record Refund Transaction
            await tx.transaction.create({
                data: {
                    userId: payment.userId,
                    paymentId: payment.id,
                    type: "REFUND",
                    status: "SUCCESS",
                    amount: payment.amount,
                    currency: payment.currency,
                },
            });
            
            logger.info(`[WEBHOOK] Successfully processed refund for order: ${orderId}`);
        });
    }

    /**
     * GET /v1/payments/history
     * Returns a cursor-paginated list of the user's payment history.
     * Each item includes course summary + payment + latest transaction status.
     */
    public async getPaymentHistory(
        userId: string,
        limit: number = 20,
        cursor?: string
    ) {
        const payments = await db.payment.findMany({
            where: { userId },
            take: limit + 1,
            ...(cursor && {
                skip: 1,
                cursor: { id: cursor },
            }),
            orderBy: { createdAt: "desc" },
            select: {
                id: true,
                amount: true,
                currency: true,
                status: true,
                provider: true,
                providerOrderId: true,
                createdAt: true,
                enrollment: {
                    select: {
                        id: true,
                        status: true,
                        enrolledAt: true,
                        course: {
                            select: {
                                id: true,
                                title: true,
                                isFree: true,
                                thumbnail: {
                                    select: { url: true },
                                },
                            },
                        },
                    },
                },
                transactions: {
                    orderBy: { createdAt: "desc" },
                    take: 1, // Only the most recent transaction
                    select: {
                        id: true,
                        type: true,
                        status: true,
                        amount: true,
                        providerReferenceId: true,
                        failureReason: true,
                        createdAt: true,
                    },
                },
            },
        });

        let nextCursor: string | undefined = undefined;
        if (payments.length > limit) {
            const nextItem = payments.pop();
            nextCursor = nextItem?.id;
        }

        return { items: payments, nextCursor };
    }
}

export const paymentService = new PaymentService();
