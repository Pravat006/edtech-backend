import { Request, Response } from "express";
import { razorpayService } from "@/services/razorpay.service";
import { paymentService } from "./payment.service";
import { logger } from "@/config/logger";
import status from "http-status";

/**
 * Handle Razorpay webhook events
 * POST /v1/payments/webhooks/razorpay
 */
export const handleRazorpayWebhook = async (req: Request, res: Response) => {
    try {
        const webhookSignature = req.headers['x-razorpay-signature'] as string;

        if (!webhookSignature) {
            logger.error('[WEBHOOK] Missing webhook signature');
            res.status(status.BAD_REQUEST).json({
                error: 'Missing signature'
            });
            return;
        }

        // Verify the webhook signature
        // Note: req.body MUST be raw Buffer or parsed string for accurate validation
        const isValid = razorpayService.verifyWebhookSignature(req.body, webhookSignature);

        if (!isValid) {
            logger.error('[WEBHOOK] Invalid webhook signature');
            res.status(status.UNAUTHORIZED).json({
                error: 'Invalid signature'
            });
            return;
        }

        // For Express with body-parser, if we used express.raw(), req.body is a Buffer
        // We need to parse it to JSON to read the event
        let parsedBody;
        try {
            parsedBody = Buffer.isBuffer(req.body)
                ? JSON.parse(req.body.toString('utf8'))
                : req.body;
        } catch (e) {
            logger.error('[WEBHOOK] Failed to parse webhook body');
            res.status(status.BAD_REQUEST).json({ error: 'Invalid body' });
            return;
        }

        const event = parsedBody.event;
        const payload = parsedBody.payload;

        logger.info(`[WEBHOOK] Received event: ${event}`);

        switch (event) {
            case 'payment.authorized':
            case 'payment.captured':
            case 'order.paid':
                await paymentService.handlePaymentSuccessWebhook(payload);
                break;

            case 'payment.failed':
                await paymentService.handlePaymentFailureWebhook(payload);
                break;

            case 'refund.created':
            case 'refund.processed':
                await paymentService.handleRefundWebhook(payload);
                break;

            default:
                logger.warn(`[WEBHOOK] Unhandled event type: ${event}`);
        }

        res.status(status.OK).json({ status: 'ok' });

    } catch (error) {
        logger.error('[WEBHOOK] Error processing webhook:', error);
        res.status(status.OK).json({ status: 'error', message: 'Internal error' });
    }
};
