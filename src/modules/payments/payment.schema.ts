import { z } from "zod";

export const InitiateCheckoutSchema = z.object({
    courseId: z.string().uuid("Invalid course ID"),
    couponCode: z.string().trim().optional(),
});

export type InitiateCheckout = z.infer<typeof InitiateCheckoutSchema>;

export const VerifyPaymentSchema = z.object({
    paymentId: z.string().min(1, "Payment ID is required"),
    orderId: z.string().min(1, "Order ID is required"),
    signature: z.string().min(1, "Payment signature is required"),
});

export type VerifyPayment = z.infer<typeof VerifyPaymentSchema>;
