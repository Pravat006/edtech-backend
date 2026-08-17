import { Router } from "express";
import { validateRequest } from "@/middlewares/validateRequest";
import { authenticateUser } from "@/middlewares/auth.middleware";
import * as paymentController from "./payment.controller";
import * as webhookController from "./webhook.controller";
import express from "express";
import { InitiateCheckoutSchema, VerifyPaymentSchema } from "./payment.schema";

const router = Router();

router.post(
    "/checkout/initiate",
    authenticateUser,
    validateRequest(InitiateCheckoutSchema),
    paymentController.initiateCheckout
);

router.post(
    "/checkout/verify",
    authenticateUser,
    validateRequest(VerifyPaymentSchema),
    paymentController.verifyPayment
);

router.get(
    "/history",
    authenticateUser,
    paymentController.getPaymentHistory
);

router.post(
    "/webhooks/razorpay",
    express.raw({ type: "application/json" }),
    webhookController.handleRazorpayWebhook
);

export default router;
