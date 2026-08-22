import httpStatus from "http-status";
import { db } from "@/config/database";
import { APIError } from "@/utils/APIError";
import { referralService } from "@/modules/referral/referral.service";

class AdminReferralService {
    /**
     * Get system-wide referral performance statistics
     */
    public async getStats() {
        const totalReferrals = await db.referral.count();
        const signedUpCount = await db.referral.count({ where: { status: "SIGNED_UP" } });
        const rewardedCount = await db.referral.count({ where: { status: "REWARDED" } });

        const totalPayoutAggregate = await db.transaction.aggregate({
            where: {
                type: "REFERRAL_CREDIT",
                status: "SUCCESS",
            },
            _sum: {
                amount: true,
            },
        });

        const totalPayout = totalPayoutAggregate._sum.amount ? Number(totalPayoutAggregate._sum.amount) : 0;

        const config = await this.getReferralConfig();

        return {
            totalReferrals,
            signedUpCount,
            rewardedCount,
            conversionRate: totalReferrals > 0 ? Number(((rewardedCount / totalReferrals) * 100).toFixed(1)) : 0,
            totalPayout,
            config,
        };
    }

    /**
     * Paginated referral records for admin management
     */
    public async getReferralsList(params: {
        page?: number;
        limit?: number;
        status?: string;
        search?: string;
    }) {
        const page = params.page || 1;
        const limit = params.limit || 20;
        const skip = (page - 1) * limit;

        const where: any = {};

        if (params.status) {
            where.status = params.status;
        }

        if (params.search) {
            const search = params.search.trim();
            where.OR = [
                { codeUsed: { contains: search, mode: "insensitive" } },
                { referrer: { name: { contains: search, mode: "insensitive" } } },
                { referrer: { phoneNumber: { contains: search } } },
                { referee: { name: { contains: search, mode: "insensitive" } } },
                { referee: { phoneNumber: { contains: search } } },
            ];
        }

        const [referrals, total] = await Promise.all([
            db.referral.findMany({
                where,
                skip,
                take: limit,
                orderBy: { createdAt: "desc" },
                include: {
                    referrer: {
                        select: { id: true, name: true, phoneNumber: true, email: true },
                    },
                    referee: {
                        select: { id: true, name: true, phoneNumber: true, email: true },
                    },
                },
            }),
            db.referral.count({ where }),
        ]);

        return {
            referrals: referrals.map((r) => ({
                id: r.id,
                codeUsed: r.codeUsed,
                status: r.status,
                rewardAmount: r.rewardAmount ? Number(r.rewardAmount) : 0,
                refereeRewardAmount: r.refereeRewardAmount ? Number(r.refereeRewardAmount) : 0,
                referrer: r.referrer,
                referee: r.referee,
                createdAt: r.createdAt,
                rewardedAt: r.rewardedAt,
            })),
            pagination: {
                page,
                limit,
                total,
                totalPages: Math.ceil(total / limit),
            },
        };
    }

    /**
     * Get active referral configuration
     */
    public async getReferralConfig() {
        let config = await db.referralConfig.findUnique({
            where: { id: "default" },
        });

        if (!config) {
            config = await db.referralConfig.create({
                data: {
                    id: "default",
                    referrerRewardCredits: 100,
                    refereeRewardCredits: 50,
                    minPurchaseAmount: 0,
                    isEnabled: true,
                },
            });
        }

        return {
            id: config.id,
            referrerRewardCredits: config.referrerRewardCredits,
            refereeRewardCredits: config.refereeRewardCredits,
            minPurchaseAmount: Number(config.minPurchaseAmount),
            isEnabled: config.isEnabled,
            updatedAt: config.updatedAt,
        };
    }

    /**
     * Update global referral settings
     */
    public async updateReferralConfig(data: {
        referrerRewardCredits?: number;
        refereeRewardCredits?: number;
        minPurchaseAmount?: number;
        isEnabled?: boolean;
    }) {
        const config = await db.referralConfig.upsert({
            where: { id: "default" },
            update: {
                ...(data.referrerRewardCredits !== undefined && { referrerRewardCredits: data.referrerRewardCredits }),
                ...(data.refereeRewardCredits !== undefined && { refereeRewardCredits: data.refereeRewardCredits }),
                ...(data.minPurchaseAmount !== undefined && { minPurchaseAmount: data.minPurchaseAmount }),
                ...(data.isEnabled !== undefined && { isEnabled: data.isEnabled }),
            },
            create: {
                id: "default",
                referrerRewardCredits: data.referrerRewardCredits ?? 100,
                refereeRewardCredits: data.refereeRewardCredits ?? 50,
                minPurchaseAmount: data.minPurchaseAmount ?? 0,
                isEnabled: data.isEnabled ?? true,
            },
        });

        return config;
    }

    /**
     * Manual override to force reward a pending referral
     */
    public async overrideReward(referralId: string) {
        const referral = await db.referral.findUnique({
            where: { id: referralId },
        });

        if (!referral) {
            throw new APIError(httpStatus.NOT_FOUND, "Referral record not found");
        }

        if (referral.status === "REWARDED") {
            throw new APIError(httpStatus.BAD_REQUEST, "Referral has already been rewarded");
        }

        return await referralService.processReferralRewardOnPurchase(referral.refereeId, 0);
    }
}

export const adminReferralService = new AdminReferralService();
