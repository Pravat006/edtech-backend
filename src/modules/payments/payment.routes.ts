import { Router } from "express";
import { paymentInfo } from "./payment.controller";
import { paymentWebhook } from "./webhook.controller";

const router = Router();

router.get("/", paymentInfo);
router.post("/webhook", paymentWebhook);

export default router;

