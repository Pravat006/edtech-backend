import { Router } from "express";
import { aiChatController } from "./ai-chat.controller";
import { validateRequest } from "@/middlewares/validateRequest";
import { authenticateUser } from "@/middlewares/auth.middleware";
import { AskDoubtSchema, CreateConversationSchema } from "./ai-chat.schema";

const router = Router();

// Protect all AI Doubt Chatbot endpoints with JWT User Authentication
router.use(authenticateUser);

// Standard HTTP JSON endpoint to ask a doubt
router.post(
    "/ask",
    validateRequest(AskDoubtSchema),
    aiChatController.askDoubt
);

// Real-Time Server-Sent Events (SSE) streaming endpoint
router.post(
    "/ask/stream",
    validateRequest(AskDoubtSchema),
    aiChatController.streamDoubt
);

// Explicit endpoint to stop/cancel an active streaming AI response
router.post("/ask/stop", aiChatController.stopStream);

// Dedicated AI Credit Package routes
router.get("/credits/packages", aiChatController.getCreditPackages);
router.post("/credits/buy", aiChatController.buyCreditPackage);
router.post("/credits/create-order", aiChatController.buyCreditPackage);
router.post("/credits/verify", aiChatController.verifyCreditPackagePayment);

// Conversation management routes
router.post(
    "/conversations",
    validateRequest(CreateConversationSchema),
    aiChatController.createConversation
);

router.get("/conversations", aiChatController.getConversations);

router.get("/conversations/:conversationId/messages", aiChatController.getMessages);

router.delete("/conversations/:conversationId", aiChatController.deleteConversation);

export default router;
