import Razorpay from "razorpay";
import crypto from "crypto";
import envVars from "@/config/envVars";
import { logger } from "@/config/logger";
import { APIError } from "@/utils/APIError";
import httpStatus from "http-status";

export class RazorpayService {
    private client: Razorpay;

    constructor() {
        this.client = new Razorpay({
            key_id: envVars.RAZORPAY_KEY_ID,
            key_secret: envVars.RAZORPAY_KEY_SECRET,
        });
    }

    /**
     * Checks if valid Razorpay API keys are configured in environment variables.
     */
    public isConfigured(): boolean {
        return (
            Boolean(envVars.RAZORPAY_KEY_ID) &&
            !envVars.RAZORPAY_KEY_ID.includes("dummy") &&
            Boolean(envVars.RAZORPAY_KEY_SECRET) &&
            !envVars.RAZORPAY_KEY_SECRET.includes("dummy")
        );
    }

    /**
     * Creates a new Razorpay Order.
     * @param amount - Amount in standard currency units (e.g. 499 for ₹499)
     * @param currency - Currency code (e.g. "INR")
     * @param receiptId - Unique receipt identifier
     * @param notes - Optional key-value metadata to attach to the order
     */
    public async createOrder(
        amount: number,
        currency: string = "INR",
        receiptId: string,
        notes?: Record<string, string>
    ) {
        try {
            // Razorpay expects amount in smallest currency unit (paise for INR)
            const amountInPaise = Math.round(amount * 100);

            const options = {
                amount: amountInPaise,
                currency: currency.toUpperCase(),
                receipt: receiptId,
                notes: notes || {},
            };

            const order = await this.client.orders.create(options);
            return order;
        } catch (error: any) {
            logger.error("Failed to create Razorpay order:", error);
            throw new APIError(
                httpStatus.INTERNAL_SERVER_ERROR,
                `Razorpay order creation failed: ${error.message || "Unknown error"}`
            );
        }
    }

    /**
     * Timing-safe verification of the cryptographic payment signature returned by Razorpay client SDK.
     * Prevents HMAC timing side-channel attacks.
     * @param orderId - Razorpay Order ID (order_...)
     * @param paymentId - Razorpay Payment ID (pay_...)
     * @param signature - Signature hash returned by client
     */
    public verifyPaymentSignature(
        orderId: string,
        paymentId: string,
        signature: string
    ): boolean {
        if (!orderId || !paymentId || !signature) {
            return false;
        }

        try {
            const body = `${orderId}|${paymentId}`;
            const expectedSignature = crypto
                .createHmac("sha256", envVars.RAZORPAY_KEY_SECRET)
                .update(body)
                .digest("hex");

            return this.timingSafeEqual(expectedSignature, signature);
        } catch (error) {
            logger.error("Error verifying Razorpay payment signature:", error);
            return false;
        }
    }

    /**
     * Timing-safe verification of the Razorpay Webhook signature.
     * @param webhookBody - Raw request body (string, Buffer, or object)
     * @param webhookSignature - Header value from x-razorpay-signature
     */
    public verifyWebhookSignature(
        webhookBody: string | Buffer | Record<string, any>,
        webhookSignature: string
    ): boolean {
        if (!webhookBody || !webhookSignature) {
            return false;
        }

        try {
            let body: string;
            if (Buffer.isBuffer(webhookBody)) {
                body = webhookBody.toString("utf8");
            } else if (typeof webhookBody === "string") {
                body = webhookBody;
            } else {
                body = JSON.stringify(webhookBody);
            }

            const expectedSignature = crypto
                .createHmac("sha256", envVars.RAZORPAY_WEBHOOK_SECRET)
                .update(body)
                .digest("hex");

            return this.timingSafeEqual(expectedSignature, webhookSignature);
        } catch (error) {
            logger.error("Error verifying Razorpay webhook signature:", error);
            return false;
        }
    }

    /**
     * Triggers a refund for a completed payment via Razorpay.
     * @param paymentId - Razorpay Payment ID (pay_...)
     * @param amount - Optional partial refund amount in standard currency units (full refund if omitted)
     * @param notes - Optional metadata notes for the refund
     */
    public async createRefund(
        paymentId: string,
        amount?: number,
        notes?: Record<string, string>
    ) {
        try {
            const options: Record<string, any> = {
                notes: notes || {},
            };

            if (amount !== undefined && amount > 0) {
                options.amount = Math.round(amount * 100);
            }

            const refund = await this.client.payments.refund(paymentId, options);
            return refund;
        } catch (error: any) {
            logger.error(`Failed to initiate Razorpay refund for payment ${paymentId}:`, error);
            throw new APIError(
                httpStatus.INTERNAL_SERVER_ERROR,
                `Razorpay refund failed: ${error.message || "Unknown error"}`
            );
        }
    }

    /**
     * Fetches details of an order from Razorpay.
     * @param orderId - Razorpay Order ID
     */
    public async fetchOrder(orderId: string) {
        try {
            return await this.client.orders.fetch(orderId);
        } catch (error: any) {
            logger.error(`Failed to fetch Razorpay order ${orderId}:`, error);
            throw new APIError(
                httpStatus.NOT_FOUND,
                `Razorpay order not found: ${error.message}`
            );
        }
    }

    /**
     * Fetches all payments associated with an order from Razorpay.
     * @param orderId - Razorpay Order ID
     */
    public async fetchOrderPayments(orderId: string) {
        try {
            const result = await this.client.orders.fetchPayments(orderId);
            return result.items || [];
        } catch (error: any) {
            logger.error(`Failed to fetch payments for Razorpay order ${orderId}:`, error);
            throw new APIError(
                httpStatus.NOT_FOUND,
                `Razorpay order payments not found: ${error.message}`
            );
        }
    }

    /**
     * Fetches details of a payment from Razorpay.
     * @param paymentId - Razorpay Payment ID
     */
    public async fetchPayment(paymentId: string) {
        try {
            return await this.client.payments.fetch(paymentId);
        } catch (error: any) {
            logger.error(`Failed to fetch Razorpay payment ${paymentId}:`, error);
            throw new APIError(
                httpStatus.NOT_FOUND,
                `Razorpay payment not found: ${error.message}`
            );
        }
    }

    /**
     * Helper to perform timing-safe string comparison to prevent timing attacks.
     */
    private timingSafeEqual(a: string, b: string): boolean {
        const bufA = Buffer.from(a, "utf8");
        const bufB = Buffer.from(b, "utf8");

        if (bufA.length !== bufB.length) {
            return false;
        }

        return crypto.timingSafeEqual(bufA, bufB);
    }
}

export const razorpayService = new RazorpayService();