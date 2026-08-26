import httpStatus from "http-status";
import { db } from "@/config/database";
import envVars from "@/config/envVars";
import { APIError } from "@/utils/APIError";
import { razorpayService } from "@/services/razorpay.service";
import { courseAccessService } from "./services/course-access.service";
import { courseContextService } from "./services/course-context.service";
import { contentGuardService } from "./services/content-guard.service";
import { promptService } from "./services/prompt.service";
import { responseCacheService } from "./services/response-cache.service";
import { createAIProvider } from "./providers/ai-provider.factory";
import { ChatMessagePayload, GenerateResult } from "./providers/ai-provider.interface";
import { logger } from "@/config/logger";

export interface AskDoubtInput {
    userId: string;
    courseId?: string;
    lessonId?: string;
    conversationId?: string;
    message: string;
    queryType?: "quick" | "detailed";
}

export interface CreditPackage {
    id: string;
    name: string;
    price: number; // in INR
    credits: number; // dedicated AI credits
    bonusCredits: number;
    description: string;
    popular?: boolean;
}

export const AI_CREDIT_PACKAGES: CreditPackage[] = [
    {
        id: "pack_starter_10",
        name: "Starter Pack",
        price: 10,
        credits: 10,
        bonusCredits: 0,
        description: "10 Dedicated AI Doubt Solver Credits (₹1/query)",
    },
    {
        id: "pack_value_50",
        name: "Value Pack",
        price: 50,
        credits: 60,
        bonusCredits: 10,
        description: "50 Credits + 10 Free Bonus Credits (+20% extra value)",
        popular: true,
    },
    {
        id: "pack_pro_100",
        name: "Pro Pack",
        price: 100,
        credits: 130,
        bonusCredits: 30,
        description: "100 Credits + 30 Free Bonus Credits (+30% extra value)",
    },
];

export class AIChatService {
    /**
     * Get or initialize a user's wallet with initial welcome credits
     */
    public async getOrInitializeWallet(userId: string) {
        let wallet = await db.wallet.findUnique({ where: { userId } });

        if (!wallet) {
            const welcomeCredits = envVars.AI_INITIAL_WELCOME_CREDITS || 5;

            wallet = await db.$transaction(async (tx) => {
                const newWallet = await tx.wallet.create({
                    data: {
                        userId,
                        referralCredits: welcomeCredits,
                        aiCredits: 0,
                        balanceCredits: welcomeCredits,
                    },
                });

                if (welcomeCredits > 0) {
                    await tx.transaction.create({
                        data: {
                            userId,
                            amount: welcomeCredits,
                            type: "PROMOTIONAL_CREDIT",
                            status: "SUCCESS",
                            providerReferenceId: "INITIAL_WELCOME_AI_BONUS",
                        },
                    });
                }

                return newWallet;
            });
        }

        return wallet;
    }

    /**
     * Internal helper to deduct credits with priority: aiCredits first, then referralCredits
     */
    private calculateCreditDeduction(
        wallet: { referralCredits: number; aiCredits: number; balanceCredits: number },
        creditCost: number
    ) {
        let newAiCredits = wallet.aiCredits;
        let newReferralCredits = wallet.referralCredits;

        if (newAiCredits >= creditCost) {
            newAiCredits -= creditCost;
        } else {
            const remainingNeeded = creditCost - newAiCredits;
            newAiCredits = 0;
            newReferralCredits = Math.max(0, newReferralCredits - remainingNeeded);
        }

        const newBalance = newAiCredits + newReferralCredits;

        return {
            aiCredits: newAiCredits,
            referralCredits: newReferralCredits,
            balanceCredits: newBalance,
        };
    }

    /**
     * Create a new conversation thread
     */
    public async createConversation(userId: string, courseId?: string, lessonId?: string, title?: string) {
        if (courseId) {
            await courseAccessService.verifyCourseAccess(userId, courseId);
            await courseAccessService.verifyLessonAccess(courseId, lessonId);
        }

        const conversation = await db.chatConversation.create({
            data: {
                userId,
                courseId: courseId || null,
                lessonId: lessonId || null,
                title: title || "New Doubt Discussion",
            },
        });

        return conversation;
    }

    /**
     * Get paginated conversations for a user
     */
    public async getConversations(userId: string, courseId?: string) {
        const where: any = { userId };
        if (courseId) {
            where.courseId = courseId;
        }

        const conversations = await db.chatConversation.findMany({
            where,
            orderBy: { updatedAt: "desc" },
            include: {
                messages: {
                    orderBy: { createdAt: "desc" },
                    take: 1,
                },
            },
        });

        return conversations.map((c) => ({
            id: c.id,
            courseId: c.courseId,
            lessonId: c.lessonId,
            title: c.title || "Untitled Conversation",
            createdAt: c.createdAt,
            updatedAt: c.updatedAt,
            lastMessage: c.messages[0] ? c.messages[0].content.slice(0, 80) : null,
        }));
    }

    /**
     * Get conversation messages history
     */
    public async getMessages(userId: string, conversationId: string) {
        const conversation = await db.chatConversation.findFirst({
            where: { id: conversationId, userId },
        });

        if (!conversation) {
            throw new APIError(httpStatus.NOT_FOUND, "Conversation thread not found");
        }

        const messages = await db.chatMessage.findMany({
            where: { conversationId },
            orderBy: { createdAt: "asc" },
        });

        return {
            conversation,
            messages,
        };
    }

    /**
     * Delete a conversation thread
     */
    public async deleteConversation(userId: string, conversationId: string) {
        const conversation = await db.chatConversation.findFirst({
            where: { id: conversationId, userId },
        });

        if (!conversation) {
            throw new APIError(httpStatus.NOT_FOUND, "Conversation thread not found");
        }

        await db.chatConversation.delete({
            where: { id: conversationId },
        });

        return { message: "Conversation thread deleted successfully" };
    }

    /**
     * Primary Doubt-Solving Orchestration Engine (JSON Response)
     */
    public async askDoubt(input: AskDoubtInput) {
        const { userId, courseId, lessonId, message, queryType = "detailed" } = input;

        // 1. Course & Lesson Access Authorization (if courseId provided)
        if (courseId) {
            await courseAccessService.verifyCourseAccess(userId, courseId);
            await courseAccessService.verifyLessonAccess(courseId, lessonId);
        }

        // 2. Content Guard Check
        const guardResult = contentGuardService.checkLocally(message);
        if (!guardResult.allowed) {
            throw new APIError(
                httpStatus.BAD_REQUEST,
                contentGuardService.getRejectionMessage(guardResult.reason)
            );
        }

        // 3. Model A Credit Economics Calculation
        const rawCost = queryType === "quick" ? envVars.AI_CREDIT_COST_QUICK : envVars.AI_CREDIT_COST_DETAILED;
        const creditCost = Math.ceil(rawCost || 1);

        // 4. Wallet Check (Auto-grant 5 initial free welcome credits if new user)
        const wallet = await this.getOrInitializeWallet(userId);

        const totalAvailable = wallet.aiCredits + wallet.referralCredits;
        if (creditCost > 0 && totalAvailable < creditCost) {
            throw new APIError(
                httpStatus.PAYMENT_REQUIRED,
                `Insufficient AI credits in your wallet (Required: ${creditCost} Credit, Current Balance: ${totalAvailable}). Top up AI credits or refer friends to get free credits.`
            );
        }

        // 5. Retrieve or Create Conversation Thread
        let conversationId = input.conversationId;
        if (conversationId) {
            const conversation = await db.chatConversation.findFirst({
                where: { id: conversationId, userId },
            });
            if (!conversation) {
                throw new APIError(httpStatus.NOT_FOUND, "Specified conversation thread not found");
            }
        } else {
            const shortTitle = message.slice(0, 35) + (message.length > 35 ? "..." : "");
            const conversation = await db.chatConversation.create({
                data: {
                    userId,
                    courseId: courseId || null,
                    lessonId: lessonId || null,
                    title: shortTitle,
                },
            });
            conversationId = conversation.id;
        }

        // 6. Cache Lookup
        const providerStrategy = createAIProvider();
        const promptVersion = envVars.AI_PROMPT_VERSION || "v1";

        const cachedContent = await responseCacheService.getCachedResponse({
            provider: providerStrategy.name,
            model: providerStrategy.model,
            promptVersion,
            courseId,
            lessonId,
            question: message,
        });

        if (cachedContent) {
            logger.info(`[AIChatService] Serving cached response for question: "${message.slice(0, 30)}..."`);

            await db.chatMessage.createMany({
                data: [
                    { conversationId, role: "USER", content: message },
                    {
                        conversationId,
                        role: "ASSISTANT",
                        content: cachedContent,
                        fromCache: true,
                        provider: providerStrategy.name,
                        model: providerStrategy.model,
                        promptVersion,
                        creditCost: 0,
                    },
                ],
            });

            await db.chatConversation.update({
                where: { id: conversationId },
                data: { updatedAt: new Date() },
            });

            return {
                conversationId,
                message: {
                    role: "assistant",
                    content: cachedContent,
                    fromCache: true,
                    creditCostDeducted: 0,
                    walletBalanceRemaining: wallet.balanceCredits,
                    aiCreditsRemaining: wallet.aiCredits,
                    referralCreditsRemaining: wallet.referralCredits,
                },
            };
        }

        // 7. Context & Prompt Assembly
        const context = await courseContextService.getContext(courseId, lessonId);
        const systemPrompt = promptService.buildSystemPrompt(context.summaryText);

        const previousMessages = await db.chatMessage.findMany({
            where: { conversationId },
            orderBy: { createdAt: "desc" },
            take: 10,
        });

        const historyPayload: ChatMessagePayload[] = previousMessages
            .reverse()
            .map((msg) => ({
                role: msg.role === "USER" ? "user" : "assistant",
                content: msg.content,
            }));

        historyPayload.push({ role: "user", content: message });

        // 8. AI Response Generation
        const aiResult = await providerStrategy.generateResponse(historyPayload, {
            systemPrompt,
            temperature: 0.5,
            maxTokens: queryType === "quick" ? 400 : 800,
        });

        // 9. Real-Time Credit Deduction & Transaction Logging
        const result = await db.$transaction(async (tx) => {
            await tx.chatMessage.create({
                data: { conversationId, role: "USER", content: message },
            });

            const assistantMsg = await tx.chatMessage.create({
                data: {
                    conversationId,
                    role: "ASSISTANT",
                    content: aiResult.content,
                    fromCache: false,
                    inputTokens: aiResult.usage?.inputTokens,
                    outputTokens: aiResult.usage?.outputTokens,
                    totalTokens: aiResult.usage?.totalTokens,
                    provider: aiResult.provider,
                    model: aiResult.model,
                    promptVersion,
                    creditCost,
                },
            });

            let updatedWallet = wallet;
            if (creditCost > 0) {
                const nextBal = this.calculateCreditDeduction(wallet, creditCost);

                updatedWallet = await tx.wallet.update({
                    where: { userId },
                    data: {
                        aiCredits: nextBal.aiCredits,
                        referralCredits: nextBal.referralCredits,
                        balanceCredits: nextBal.balanceCredits,
                    },
                });

                await tx.transaction.create({
                    data: {
                        userId,
                        amount: creditCost,
                        type: "AI_CREDIT_USAGE",
                        status: "SUCCESS",
                    },
                });
            }

            await tx.chatConversation.update({
                where: { id: conversationId },
                data: { updatedAt: new Date() },
            });

            return { assistantMsg, updatedWallet };
        });

        // 10. Cache Response
        await responseCacheService.cacheResponse(
            {
                provider: providerStrategy.name,
                model: providerStrategy.model,
                promptVersion,
                courseId,
                lessonId,
                question: message,
            },
            aiResult.content
        );

        return {
            conversationId,
            message: {
                id: result.assistantMsg.id,
                role: "assistant",
                content: aiResult.content,
                fromCache: false,
                usage: aiResult.usage,
                provider: aiResult.provider,
                model: aiResult.model,
                creditCostDeducted: creditCost,
                walletBalanceRemaining: result.updatedWallet.balanceCredits,
                aiCreditsRemaining: result.updatedWallet.aiCredits,
                referralCreditsRemaining: result.updatedWallet.referralCredits,
            },
        };
    }

    /**
     * Server-Sent Events (SSE) Token-by-Token Real-Time Streaming Doubt Engine
     */
    private activeStreamControllers = new Map<string, AbortController>();

    /**
     * Register an AbortController for an active streaming doubt request
     */
    public registerStreamController(userId: string, conversationId?: string): AbortController {
        const controller = new AbortController();
        const key = conversationId ? `${userId}:${conversationId}` : userId;
        this.activeStreamControllers.set(key, controller);
        this.activeStreamControllers.set(userId, controller);
        return controller;
    }

    /**
     * Unregister an AbortController after streaming finishes or cancels
     */
    public unregisterStreamController(userId: string, conversationId?: string) {
        const key = conversationId ? `${userId}:${conversationId}` : userId;
        this.activeStreamControllers.delete(key);
        this.activeStreamControllers.delete(userId);
    }

    /**
     * Stop/Cancel an active ongoing AI response stream for a user
     */
    public stopActiveStream(userId: string, conversationId?: string): boolean {
        const key = conversationId ? `${userId}:${conversationId}` : userId;
        const controller = this.activeStreamControllers.get(key) || this.activeStreamControllers.get(userId);

        if (controller) {
            logger.info(`[AIChatService] Manually stopping active stream for user ${userId} (key: ${key})`);
            controller.abort();
            this.activeStreamControllers.delete(key);
            this.activeStreamControllers.delete(userId);
            return true;
        }

        return false;
    }

    public async askDoubtStream(
        input: AskDoubtInput,
        onChunk: (chunk: string) => void,
        abortSignal?: AbortSignal
    ) {
        const { userId, courseId, lessonId, message, queryType = "detailed" } = input;

        if (courseId) {
            await courseAccessService.verifyCourseAccess(userId, courseId);
            await courseAccessService.verifyLessonAccess(courseId, lessonId);
        }

        const guardResult = contentGuardService.checkLocally(message);
        if (!guardResult.allowed) {
            throw new APIError(
                httpStatus.BAD_REQUEST,
                contentGuardService.getRejectionMessage(guardResult.reason)
            );
        }

        const rawCost = queryType === "quick" ? envVars.AI_CREDIT_COST_QUICK : envVars.AI_CREDIT_COST_DETAILED;
        const creditCost = Math.ceil(rawCost || 1);

        const wallet = await this.getOrInitializeWallet(userId);
        const totalAvailable = wallet.aiCredits + wallet.referralCredits;

        if (creditCost > 0 && totalAvailable < creditCost) {
            throw new APIError(
                httpStatus.PAYMENT_REQUIRED,
                `Insufficient AI credits in your wallet (Required: ${creditCost} Credit, Current Balance: ${totalAvailable}). Top up AI credits or refer friends to get free credits.`
            );
        }

        let conversationId = input.conversationId;
        if (conversationId) {
            const conversation = await db.chatConversation.findFirst({
                where: { id: conversationId, userId },
            });
            if (!conversation) {
                throw new APIError(httpStatus.NOT_FOUND, "Specified conversation thread not found");
            }
        } else {
            const shortTitle = message.slice(0, 35) + (message.length > 35 ? "..." : "");
            const conversation = await db.chatConversation.create({
                data: {
                    userId,
                    courseId,
                    lessonId: lessonId || null,
                    title: shortTitle,
                },
            });
            conversationId = conversation.id;
        }

        const providerStrategy = createAIProvider();
        const promptVersion = envVars.AI_PROMPT_VERSION || "v1";

        const cachedContent = await responseCacheService.getCachedResponse({
            provider: providerStrategy.name,
            model: providerStrategy.model,
            promptVersion,
            courseId,
            lessonId,
            question: message,
        });

        if (cachedContent) {
            logger.info(`[AIChatService] SSE Streaming cached response for question: "${message.slice(0, 30)}..."`);
            onChunk(cachedContent);

            await db.chatMessage.createMany({
                data: [
                    { conversationId, role: "USER", content: message },
                    {
                        conversationId,
                        role: "ASSISTANT",
                        content: cachedContent,
                        fromCache: true,
                        provider: providerStrategy.name,
                        model: providerStrategy.model,
                        promptVersion,
                        creditCost: 0,
                    },
                ],
            });

            await db.chatConversation.update({
                where: { id: conversationId },
                data: { updatedAt: new Date() },
            });

            return {
                conversationId,
                fromCache: true,
                creditCostDeducted: 0,
                walletBalanceRemaining: wallet.balanceCredits,
                aiCreditsRemaining: wallet.aiCredits,
                referralCreditsRemaining: wallet.referralCredits,
            };
        }

        const context = await courseContextService.getContext(courseId, lessonId);
        const systemPrompt = promptService.buildSystemPrompt(context.summaryText);

        const previousMessages = await db.chatMessage.findMany({
            where: { conversationId },
            orderBy: { createdAt: "desc" },
            take: 10,
        });

        const historyPayload: ChatMessagePayload[] = previousMessages
            .reverse()
            .map((msg) => ({
                role: msg.role === "USER" ? "user" : "assistant",
                content: msg.content,
            }));

        historyPayload.push({ role: "user", content: message });

        let aiResult: GenerateResult;
        const generateOptions = {
            systemPrompt,
            temperature: 0.5,
            maxTokens: queryType === "quick" ? 400 : 800,
            abortSignal,
        };

        if (providerStrategy.generateStreamResponse) {
            aiResult = await providerStrategy.generateStreamResponse(historyPayload, generateOptions, onChunk);
        } else {
            aiResult = await providerStrategy.generateResponse(historyPayload, generateOptions);
            onChunk(aiResult.content);
        }

        const result = await db.$transaction(async (tx) => {
            await tx.chatMessage.create({
                data: { conversationId, role: "USER", content: message },
            });

            const assistantMsg = await tx.chatMessage.create({
                data: {
                    conversationId,
                    role: "ASSISTANT",
                    content: aiResult.content,
                    fromCache: false,
                    inputTokens: aiResult.usage?.inputTokens,
                    outputTokens: aiResult.usage?.outputTokens,
                    totalTokens: aiResult.usage?.totalTokens,
                    provider: aiResult.provider,
                    model: aiResult.model,
                    promptVersion,
                    creditCost,
                },
            });

            let updatedWallet = wallet;
            if (creditCost > 0) {
                const nextBal = this.calculateCreditDeduction(wallet, creditCost);

                updatedWallet = await tx.wallet.update({
                    where: { userId },
                    data: {
                        aiCredits: nextBal.aiCredits,
                        referralCredits: nextBal.referralCredits,
                        balanceCredits: nextBal.balanceCredits,
                    },
                });

                await tx.transaction.create({
                    data: {
                        userId,
                        amount: creditCost,
                        type: "AI_CREDIT_USAGE",
                        status: "SUCCESS",
                    },
                });
            }

            await tx.chatConversation.update({
                where: { id: conversationId },
                data: { updatedAt: new Date() },
            });

            return { assistantMsg, updatedWallet };
        });

        await responseCacheService.cacheResponse(
            {
                provider: providerStrategy.name,
                model: providerStrategy.model,
                promptVersion,
                courseId,
                lessonId,
                question: message,
            },
            aiResult.content
        );

        return {
            conversationId,
            messageId: result.assistantMsg.id,
            fromCache: false,
            creditCostDeducted: creditCost,
            walletBalanceRemaining: result.updatedWallet.balanceCredits,
            aiCreditsRemaining: result.updatedWallet.aiCredits,
            referralCreditsRemaining: result.updatedWallet.referralCredits,
        };
    }

    /**
     * Dedicated AI Credit Package Purchases (queries dynamic active DB packages)
     */
    public async getCreditPackages() {
        const dbPackages = await db.aICreditPackage.findMany({
            where: { isActive: true },
            orderBy: { price: "asc" },
        });

        if (dbPackages.length > 0) {
            return dbPackages.map((p) => ({
                id: p.id,
                name: p.name,
                price: Number(p.price),
                credits: p.credits + p.bonusCredits,
                bonusCredits: p.bonusCredits,
                description: p.description || `${p.credits} AI Doubt Solver Credits`,
                popular: p.popular,
            }));
        }

        return AI_CREDIT_PACKAGES;
    }

    /**
     * Initiate Razorpay Payment Order for AI Credit Package
     * Endpoint: POST /v1/ai-chat/credits/buy OR POST /v1/ai-chat/credits/create-order
     */
    public async initiateCreditPackageCheckout(userId: string, packageId: string) {
        if (!packageId) {
            throw new APIError(httpStatus.BAD_REQUEST, "packageId is required");
        }

        let pkg: { id: string; name: string; price: number; credits: number } | null = null;

        const dbPkg = await db.aICreditPackage.findUnique({ where: { id: packageId } });
        if (dbPkg) {
            if (!dbPkg.isActive) {
                throw new APIError(httpStatus.BAD_REQUEST, "Selected AI credit package is no longer active");
            }
            pkg = {
                id: dbPkg.id,
                name: dbPkg.name,
                price: Number(dbPkg.price),
                credits: dbPkg.credits + dbPkg.bonusCredits,
            };
        } else {
            const fallbackPkg = AI_CREDIT_PACKAGES.find((p) => p.id === packageId);
            if (fallbackPkg) {
                pkg = {
                    id: fallbackPkg.id,
                    name: fallbackPkg.name,
                    price: fallbackPkg.price,
                    credits: fallbackPkg.credits,
                };
            }
        }

        if (!pkg) {
            throw new APIError(httpStatus.NOT_FOUND, "Invalid credit package selected");
        }

        const receiptId = `rcpt_ai_${userId.slice(0, 8)}_${Date.now()}`;

        // Create Razorpay order
        const rzpOrder = await razorpayService.createOrder(
            pkg.price,
            "INR",
            receiptId,
            { packageId: pkg.id, userId, type: "AI_CREDIT_PURCHASE" }
        );

        // Create PENDING Payment in DB
        const pendingPayment = await db.payment.create({
            data: {
                userId,
                provider: "RAZORPAY",
                providerOrderId: rzpOrder.id,
                amount: pkg.price,
                currency: "INR",
                status: "PENDING",
            },
        });

        return {
            orderId: rzpOrder.id,
            amount: pkg.price,
            currency: "INR",
            paymentId: pendingPayment.id,
            key: envVars.RAZORPAY_KEY_ID,
            packageId: pkg.id,
            packageName: pkg.name,
            creditsToGrant: pkg.credits,
        };
    }

    /**
     * Verify Razorpay Payment Signature and Grant Credits to User Wallet
     * Endpoint: POST /v1/ai-chat/credits/verify
     */
    public async verifyCreditPackagePayment(
        userId: string,
        paymentId: string,
        orderId: string,
        signature: string,
        packageId?: string
    ) {
        if (!orderId || !paymentId || !signature) {
            throw new APIError(
                httpStatus.BAD_REQUEST,
                "Missing payment verification parameters (orderId, paymentId, signature)"
            );
        }

        return await db.$transaction(async (tx) => {
            // 1. Fetch pending payment
            const payment = await tx.payment.findFirst({
                where: { providerOrderId: orderId, userId },
            });

            if (!payment) {
                throw new APIError(httpStatus.NOT_FOUND, "Payment record not found for this order");
            }

            // 2. Idempotency Check
            if (payment.status === "SUCCESS") {
                const userWallet = await tx.wallet.findUnique({ where: { userId } });
                return {
                    success: true,
                    message: "Payment already processed successfully",
                    wallet: userWallet,
                };
            }

            if (payment.status === "FAILED" || payment.status === "REFUNDED") {
                throw new APIError(
                    httpStatus.BAD_REQUEST,
                    `Payment cannot be verified because status is ${payment.status}`
                );
            }

            // 3. Verify HMAC signature
            const isSignatureValid = razorpayService.verifyPaymentSignature(orderId, paymentId, signature);

            if (!isSignatureValid) {
                await tx.payment.update({
                    where: { id: payment.id },
                    data: { status: "FAILED" },
                });

                await tx.transaction.create({
                    data: {
                        userId,
                        paymentId: payment.id,
                        type: "AI_CREDIT_PURCHASE",
                        status: "FAILED",
                        amount: payment.amount,
                        currency: payment.currency,
                        failureReason: "Invalid Razorpay Payment Signature",
                    },
                });

                throw new APIError(httpStatus.BAD_REQUEST, "Invalid payment signature verification failed");
            }

            // 4. Resolve package total credits
            let totalCreditsToGrant = 0;
            const targetPkgId = packageId;

            if (targetPkgId) {
                const dbPkg = await tx.aICreditPackage.findUnique({ where: { id: targetPkgId } });
                if (dbPkg) {
                    totalCreditsToGrant = dbPkg.credits + dbPkg.bonusCredits;
                } else {
                    const fallbackPkg = AI_CREDIT_PACKAGES.find((p) => p.id === targetPkgId);
                    if (fallbackPkg) {
                        totalCreditsToGrant = fallbackPkg.credits;
                    }
                }
            }

            if (totalCreditsToGrant === 0) {
                // If packageId was not matched, deduce credits proportional to amount (e.g. ₹99 = 100 credits)
                totalCreditsToGrant = Math.round(Number(payment.amount) * 1.25);
            }

            // 5. Mark Payment as SUCCESS
            await tx.payment.update({
                where: { id: payment.id },
                data: { status: "SUCCESS" },
            });

            // 6. Update User Wallet
            const wallet = await tx.wallet.findUnique({ where: { userId } });
            const currentAiCredits = wallet?.aiCredits || 0;
            const currentRefCredits = wallet?.referralCredits || 0;

            const newAiCredits = currentAiCredits + totalCreditsToGrant;
            const newTotalBalance = currentRefCredits + newAiCredits;

            const updatedWallet = await tx.wallet.upsert({
                where: { userId },
                update: {
                    aiCredits: newAiCredits,
                    balanceCredits: newTotalBalance,
                },
                create: {
                    userId,
                    referralCredits: 0,
                    aiCredits: totalCreditsToGrant,
                    balanceCredits: totalCreditsToGrant,
                },
            });

            // 7. Audit Transaction
            await tx.transaction.create({
                data: {
                    userId,
                    paymentId: payment.id,
                    type: "AI_CREDIT_PURCHASE",
                    status: "SUCCESS",
                    amount: payment.amount,
                    currency: payment.currency,
                    providerReferenceId: paymentId,
                },
            });

            logger.info(
                `[AI_CHAT_PAYMENT] Verified Razorpay payment ${paymentId} for user ${userId}. Granted ${totalCreditsToGrant} AI credits.`
            );

            return {
                success: true,
                message: `Successfully verified payment and added ${totalCreditsToGrant} AI credits!`,
                creditsAdded: totalCreditsToGrant,
                wallet: updatedWallet,
            };
        });
    }
}

export const aiChatService = new AIChatService();
