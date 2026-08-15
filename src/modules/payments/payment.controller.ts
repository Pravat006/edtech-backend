import { Request, Response } from "express";
import httpStatus from "http-status";
import { paymentService } from "./payment.service";

/**
 * POST /v1/payments/checkout/initiate
 * Initiates checkout for a course, returning either an instant enrollment (if free)
 * or a Razorpay Order ID (if paid).
 */
export const initiateCheckout = async (req: Request, res: Response) => {
    const { courseId } = req.body;
    const userId = req.user!.id;

    const result = await paymentService.initiateCheckout(userId, courseId);

    res.status(result.isFree ? httpStatus.CREATED : httpStatus.OK).json({
        success: true,
        data: result,
    });
};

/**
 * POST /v1/payments/checkout/verify
 * Verifies Razorpay payment signature and completes enrollment.
 */
export const verifyPayment = async (req: Request, res: Response) => {
    const { paymentId, orderId, signature } = req.body;
    const userId = req.user!.id;

    const enrollment = await paymentService.verifyPayment(
        userId,
        paymentId,
        orderId,
        signature
    );

    res.status(httpStatus.OK).json({
        success: true,
        data: enrollment,
    });
};
