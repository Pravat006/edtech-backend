import { z } from "zod";

export const InitiateCheckoutSchema = z.strictObject({
    courseId: z.string().uuid("Invalid course ID"),
    couponCode: z.string().trim().max(50).optional(),
});

export type InitiateCheckout = z.infer<typeof InitiateCheckoutSchema>;

export const VerifyPaymentSchema = z.strictObject({
    paymentId: z.string().min(1, "Payment ID is required").max(255),
    orderId: z.string().min(1, "Order ID is required").max(255),
    signature: z.string().min(1, "Payment signature is required").max(255),
});

export type VerifyPayment = z.infer<typeof VerifyPaymentSchema>;
