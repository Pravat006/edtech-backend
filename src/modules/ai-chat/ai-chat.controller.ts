import { Request, Response } from "express";
import httpStatus from "http-status";
import { aiChatService } from "./ai-chat.service";
import { APIError } from "@/utils/APIError";
import { logger } from "@/config/logger";

export class AIChatController {
    /**
     * Helper to extract userId from req.user (authenticated) or test header/query (for dev API testing)
     */
    private getUserId(req: Request): string {
        const userId =
            (req as any).user?.id ||
            (req.headers["x-test-user-id"] as string) ||
            (req.query.testUserId as string);

        if (!userId) {
            throw new APIError(
                httpStatus.UNAUTHORIZED,
                "Authentication required. Provide valid user token or 'x-test-user-id' header for test mode."
            );
        }

        return userId;
    }

    /**
     * Create a new conversation thread
     */
    public createConversation = async (req: Request, res: Response) => {
        const userId = this.getUserId(req);
        const { courseId, lessonId, title } = req.body;

        const conversation = await aiChatService.createConversation(userId, courseId, lessonId, title);

        res.status(httpStatus.CREATED).json({
            success: true,
            data: conversation,
        });
    };

    /**
     * Get user's conversation threads
     */
    public getConversations = async (req: Request, res: Response) => {
        const userId = this.getUserId(req);
        const courseId = req.query.courseId as string | undefined;

        const conversations = await aiChatService.getConversations(userId, courseId);

        res.status(httpStatus.OK).json({
            success: true,
            data: conversations,
        });
    };

    /**
     * Get messages in a conversation thread
     */
    public getMessages = async (req: Request, res: Response) => {
        const userId = this.getUserId(req);
        const { conversationId } = req.params;

        const result = await aiChatService.getMessages(userId, conversationId as string);

        res.status(httpStatus.OK).json({
            success: true,
            data: result,
        });
    };

    /**
     * Delete a conversation thread
     */
    public deleteConversation = async (req: Request, res: Response) => {
        const userId = this.getUserId(req);
        const { conversationId } = req.params;

        const result = await aiChatService.deleteConversation(userId, conversationId as string);

        res.status(httpStatus.OK).json({
            success: true,
            data: result,
        });
    };

    /**
     * Ask an AI Doubt question (Standard HTTP JSON response)
     */
    public askDoubt = async (req: Request, res: Response) => {
        const userId = this.getUserId(req);
        const { courseId, lessonId, conversationId, message, queryType } = req.body;

        const result = await aiChatService.askDoubt({
            userId,
            courseId,
            lessonId,
            conversationId,
            message,
            queryType,
        });

        res.status(httpStatus.OK).json({
            success: true,
            data: result,
        });
    };

    /**
     * Stream an AI Doubt response using Server-Sent Events (SSE)
     * Endpoint: POST /v1/ai-chat/ask/stream
     */
    public streamDoubt = async (req: Request, res: Response) => {
        const userId = this.getUserId(req);
        const { courseId, lessonId, conversationId, message, queryType } = req.body;

        res.setHeader("Content-Type", "text/event-stream");
        res.setHeader("Cache-Control", "no-cache");
        res.setHeader("Connection", "keep-alive");
        res.setHeader("Access-Control-Allow-Origin", "*");
        res.flushHeaders?.();

        const abortController = aiChatService.registerStreamController(userId, conversationId);

        req.on("close", () => {
            if (!res.writableEnded) {
                logger.info(`[AIChatController] Client connection closed. Stopping stream for user ${userId}`);
                abortController.abort();
                aiChatService.unregisterStreamController(userId, conversationId);
            }
        });

        try {
            const summary = await aiChatService.askDoubtStream(
                {
                    userId,
                    courseId,
                    lessonId,
                    conversationId,
                    message,
                    queryType,
                },
                (chunk: string) => {
                    if (!abortController.signal.aborted && !res.writableEnded) {
                        res.write(`data: ${JSON.stringify({ chunk })}\n\n`);
                    }
                },
                abortController.signal
            );

            if (!res.writableEnded) {
                res.write(`data: ${JSON.stringify({ done: true, metadata: summary })}\n\n`);
                res.end();
            }
        } catch (error: any) {
            if (!res.writableEnded) {
                res.write(`data: ${JSON.stringify({ error: error?.message || "Streaming failed" })}\n\n`);
                res.end();
            }
        } finally {
            aiChatService.unregisterStreamController(userId, conversationId);
        }
    };

    /**
     * Stop an ongoing active AI message stream manually
     * Endpoint: POST /v1/ai-chat/ask/stop
     */
    public stopStream = async (req: Request, res: Response) => {
        const userId = this.getUserId(req);
        const { conversationId } = req.body;

        const stopped = aiChatService.stopActiveStream(userId, conversationId);

        res.status(httpStatus.OK).json({
            success: true,
            message: stopped
                ? "AI response stream stopped successfully"
                : "No active streaming AI message found for this conversation",
            data: { stopped },
        });
    };

    /**
     * Get available dedicated AI credit packages
     * GET /v1/ai-chat/credits/packages
     */
    public getCreditPackages = async (_req: Request, res: Response) => {
        const packages = await aiChatService.getCreditPackages();
        res.status(httpStatus.OK).json({
            success: true,
            data: packages,
        });
    };

    /**
     * Initiate Razorpay Order for purchasing a dedicated AI credit package
     * POST /v1/ai-chat/credits/buy OR POST /v1/ai-chat/credits/create-order
     */
    public buyCreditPackage = async (req: Request, res: Response) => {
        const userId = this.getUserId(req);
        const { packageId } = req.body;

        if (!packageId) {
            throw new APIError(httpStatus.BAD_REQUEST, "packageId is required");
        }

        const result = await aiChatService.initiateCreditPackageCheckout(userId, packageId);

        res.status(httpStatus.OK).json({
            success: true,
            message: "Razorpay payment order created successfully",
            data: result,
        });
    };

    /**
     * Verify Razorpay Payment Signature and Grant Credits
     * POST /v1/ai-chat/credits/verify
     */
    public verifyCreditPackagePayment = async (req: Request, res: Response) => {
        const userId = this.getUserId(req);
        const { paymentId, orderId, signature, packageId } = req.body;

        const result = await aiChatService.verifyCreditPackagePayment(
            userId,
            paymentId,
            orderId,
            signature,
            packageId
        );

        res.status(httpStatus.OK).json({
            success: true,
            message: result.message,
            data: result,
        });
    };
}

export const aiChatController = new AIChatController();
