import { Request, Response } from "express";
import { BunnySignatureVerifier } from "../services/bunny-signature-verifier";
import { bunnyWebhookService, BunnyWebhookPayload } from "../services/bunny-webhook.service";
import { logger } from "@/config/logger";
import { BUNNY_STREAM_LIBRARY_ID } from "@/config/env";
import httpStatus from "http-status";

export class BunnyWebhookController {
    /**
     * Public Webhook HTTP Endpoint: POST /v1/webhooks/bunny
     */
    public handleWebhook = async (req: Request, res: Response): Promise<void> => {
        try {
            const payload = req.body as BunnyWebhookPayload;
            const signature = (req.headers["x-bunnystream-signature"] || req.headers["x-bunny-signature"]) as string | undefined;

            if (!payload || !payload.VideoGuid) {
                res.status(httpStatus.BAD_REQUEST).json({ success: false, error: "Invalid webhook payload format" });
                return;
            }

            const libraryId = String(payload.VideoLibraryId || BUNNY_STREAM_LIBRARY_ID || "");
            const videoId = payload.VideoGuid;
            const rawBody = (req as any).rawBody ? String((req as any).rawBody) : JSON.stringify(payload);

            // Step 1: Cryptographic signature verification
            const isValidSig = BunnySignatureVerifier.verifySignature(signature, libraryId, videoId, rawBody);
            if (!isValidSig) {
                res.status(httpStatus.UNAUTHORIZED).json({ success: false, error: "Invalid webhook signature" });
                return;
            }

            // Step 2: Delegate event processing to service layer
            const result = await bunnyWebhookService.processEvent(payload);
            res.status(httpStatus.OK).json({ success: true, message: result.message });
        } catch (error: any) {
            logger.error("[BunnyWebhookController] Error handling webhook:", error);
            res.status(httpStatus.INTERNAL_SERVER_ERROR).json({ success: false, error: "Webhook processing error" });
        }
    };
}

export const bunnyWebhookController = new BunnyWebhookController();
