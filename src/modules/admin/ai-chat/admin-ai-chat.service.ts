import httpStatus from "http-status";
import { db } from "@/config/database";
import { APIError } from "@/utils/APIError";
import envVars from "@/config/envVars";

export interface CreatePackageInput {
    name: string;
    price: number;
    credits: number;
    bonusCredits?: number;
    description?: string;
    popular?: boolean;
}

export interface UpdatePackageInput {
    name?: string;
    price?: number;
    credits?: number;
    bonusCredits?: number;
    description?: string;
    popular?: boolean;
    isActive?: boolean;
}

export class AdminAIChatService {
    /**
     * Get all AI Credit Packages (Admin view - active & inactive)
     */
    public async getAllPackages() {
        return db.aICreditPackage.findMany({
            orderBy: { price: "asc" },
        });
    }

    /**
     * Create a new AI Credit Package (Super Admin only)
     */
    public async createPackage(input: CreatePackageInput) {
        if (!input.name || input.price < 0 || input.credits <= 0) {
            throw new APIError(httpStatus.BAD_REQUEST, "Invalid credit package input details");
        }

        return db.aICreditPackage.create({
            data: {
                name: input.name,
                price: input.price,
                credits: input.credits,
                bonusCredits: input.bonusCredits || 0,
                description: input.description || null,
                popular: input.popular || false,
                isActive: true,
            },
        });
    }

    /**
     * Update an existing AI Credit Package (Super Admin only)
     */
    public async updatePackage(id: string, input: UpdatePackageInput) {
        const pkg = await db.aICreditPackage.findUnique({ where: { id } });
        if (!pkg) {
            throw new APIError(httpStatus.NOT_FOUND, "AI Credit Package not found");
        }

        return db.aICreditPackage.update({
            where: { id },
            data: {
                ...(input.name !== undefined && { name: input.name }),
                ...(input.price !== undefined && { price: input.price }),
                ...(input.credits !== undefined && { credits: input.credits }),
                ...(input.bonusCredits !== undefined && { bonusCredits: input.bonusCredits }),
                ...(input.description !== undefined && { description: input.description }),
                ...(input.popular !== undefined && { popular: input.popular }),
                ...(input.isActive !== undefined && { isActive: input.isActive }),
            },
        });
    }

    /**
     * Toggle active/inactive status (Super Admin only)
     */
    public async togglePackageStatus(id: string) {
        const pkg = await db.aICreditPackage.findUnique({ where: { id } });
        if (!pkg) {
            throw new APIError(httpStatus.NOT_FOUND, "AI Credit Package not found");
        }

        return db.aICreditPackage.update({
            where: { id },
            data: { isActive: !pkg.isActive },
        });
    }

    /**
     * Delete an AI Credit Package (Super Admin only)
     */
    public async deletePackage(id: string) {
        const pkg = await db.aICreditPackage.findUnique({ where: { id } });
        if (!pkg) {
            throw new APIError(httpStatus.NOT_FOUND, "AI Credit Package not found");
        }

        await db.aICreditPackage.delete({ where: { id } });
        return { message: "Package deleted successfully" };
    }

    /**
     * Fetch AI Chat Analytics for Admin Dashboard
     */
    public async getAIAnalytics() {
        const [totalMessages, cachedMessages, transactions] = await Promise.all([
            db.chatMessage.count({ where: { role: "ASSISTANT" } }),
            db.chatMessage.count({ where: { role: "ASSISTANT", fromCache: true } }),
            db.transaction.findMany({
                where: { type: "AI_CREDIT_PURCHASE", status: "SUCCESS" },
            }),
        ]);

        const cacheHitPercentage = totalMessages > 0 ? (cachedMessages / totalMessages) * 100 : 0;
        const totalSalesRevenueINR = transactions.reduce((acc, t) => acc + Number(t.amount || 0), 0);

        return {
            totalQueriesCount: totalMessages,
            cachedQueriesCount: cachedMessages,
            cacheHitPercentage: Number(cacheHitPercentage.toFixed(2)),
            creditPackSalesRevenueINR: totalSalesRevenueINR,
            activeProvider: envVars.AI_PROVIDER,
            welcomeCreditsGrant: envVars.AI_INITIAL_WELCOME_CREDITS,
        };
    }

    /**
     * Manually grant promotional AI credits to a user (Super Admin only)
     * Accepts user ID, email address, or phone number.
     */
    public async grantPromotionalCredits(userIdentifier: string, credits: number, reason?: string) {
        if (!userIdentifier) {
            throw new APIError(httpStatus.BAD_REQUEST, "User ID or Email is required");
        }

        if (credits <= 0) {
            throw new APIError(httpStatus.BAD_REQUEST, "Credits to grant must be greater than 0");
        }

        const user = await db.user.findFirst({
            where: {
                OR: [
                    { id: userIdentifier },
                    { email: userIdentifier },
                    { phoneNumber: userIdentifier },
                ],
            },
        });

        if (!user) {
            throw new APIError(httpStatus.NOT_FOUND, `User not found for identifier '${userIdentifier}'`);
        }

        const result = await db.$transaction(async (tx) => {
            const wallet = await tx.wallet.upsert({
                where: { userId: user.id },
                update: {
                    aiCredits: { increment: credits },
                    balanceCredits: { increment: credits },
                },
                create: {
                    userId: user.id,
                    referralCredits: 0,
                    aiCredits: credits,
                    balanceCredits: credits,
                },
            });

            await tx.transaction.create({
                data: {
                    userId: user.id,
                    amount: credits,
                    type: "PROMOTIONAL_CREDIT",
                    status: "SUCCESS",
                    providerReferenceId: reason || "ADMIN_MANUAL_GRANT",
                },
            });

            return wallet;
        });

        return {
            message: `Successfully granted ${credits} promotional AI credits to user ${user.name || user.email || user.id}`,
            wallet: result,
        };
    }
}

export const adminAIChatService = new AdminAIChatService();
