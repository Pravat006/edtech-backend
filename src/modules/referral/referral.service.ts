import crypto from "crypto";
import httpStatus from "http-status";
import { db } from "@/config/database";
import { APIError } from "@/utils/APIError";
import { pushNotificationService } from "@/services/push-notification.service";

class ReferralService {
    /**
     * Get user's referral code, ensuring one exists, along with referral stats & wallet balance
     */
    public async getUserReferralDashboard(userId: string) {
        // Ensure user has a referral code
        let referralCodeObj = await db.referralCode.findUnique({
            where: { userId },
        });

        if (!referralCodeObj) {
            let uniqueCode = "SUPER" + crypto.randomBytes(3).toString("hex").toUpperCase();
            // Handle edge-case collisions
            let isDuplicate = await db.referralCode.findUnique({ where: { code: uniqueCode } });
            while (isDuplicate) {
                uniqueCode = "SUPER" + crypto.randomBytes(3).toString("hex").toUpperCase();
                isDuplicate = await db.referralCode.findUnique({ where: { code: uniqueCode } });
            }

            referralCodeObj = await db.referralCode.create({
                data: {
                    userId,
                    code: uniqueCode,
                },
            });
        }

        // Get user wallet
        let wallet = await db.wallet.findUnique({
            where: { userId },
        });

        if (!wallet) {
            wallet = await db.wallet.create({
                data: { userId, balanceCredits: 0 },
            });
        }

        // Fetch referral stats
        const totalReferrals = await db.referral.count({
            where: { referrerId: userId },
        });

        const rewardedReferrals = await db.referral.count({
            where: { referrerId: userId, status: "REWARDED" },
        });

        const totalEarnedAggregate = await db.transaction.aggregate({
            where: {
                userId,
                type: "REFERRAL_CREDIT",
                status: "SUCCESS",
            },
            _sum: {
                amount: true,
            },
        });

        const totalEarned = totalEarnedAggregate._sum.amount ? Number(totalEarnedAggregate._sum.amount) : 0;

        // Get recent referrals list
        const referrals = await db.referral.findMany({
            where: { referrerId: userId },
            orderBy: { createdAt: "desc" },
            include: {
                referee: {
                    select: {
                        id: true,
                        name: true,
                        phoneNumber: true,
                        createdAt: true,
                    },
                },
            },
        });

        // Config defaults
        const config = (await db.referralConfig.findUnique({ where: { id: "default" } })) || {
            referrerRewardCredits: 100,
            refereeRewardCredits: 50,
            isEnabled: true,
        };

        return {
            referralCode: referralCodeObj.code,
            shareUrl: `https://supermind.app/invite?code=${referralCodeObj.code}`,
            shareText: `Join me on Supermind Education! Use my referral code ${referralCodeObj.code} to get ${config.refereeRewardCredits} bonus credits on your account. Download now!`,
            walletBalance: wallet.balanceCredits,
            totalReferrals,
            rewardedReferrals,
            totalEarned,
            referrerRewardCredits: config.referrerRewardCredits,
            refereeRewardCredits: config.refereeRewardCredits,
            referrals: referrals.map((r) => ({
                id: r.id,
                refereeName: r.referee.name || `User (${r.referee.phoneNumber.slice(-4)})`,
                refereePhone: r.referee.phoneNumber,
                status: r.status,
                rewardAmount: r.rewardAmount ? Number(r.rewardAmount) : 0,
                createdAt: r.createdAt,
                rewardedAt: r.rewardedAt,
            })),
        };
    }

    /**
     * Validate if a referral code exists and is valid
     */
    public async validateReferralCode(code: string, currentUserId?: string) {
        if (!code || typeof code !== "string") {
            throw new APIError(httpStatus.BAD_REQUEST, "Referral code is required");
        }

        const normalizedCode = code.trim().toUpperCase();
        const refCode = await db.referralCode.findUnique({
            where: { code: normalizedCode },
            include: {
                user: {
                    select: {
                        name: true,
                    },
                },
            },
        });

        if (!refCode) {
            throw new APIError(httpStatus.NOT_FOUND, "Invalid referral code");
        }

        if (currentUserId && refCode.userId === currentUserId) {
            throw new APIError(httpStatus.BAD_REQUEST, "You cannot use your own referral code");
        }

        const config = (await db.referralConfig.findUnique({ where: { id: "default" } })) || {
            refereeRewardCredits: 50,
            isEnabled: true,
        };

        if (!config.isEnabled) {
            throw new APIError(httpStatus.BAD_REQUEST, "Referral program is currently inactive");
        }

        return {
            valid: true,
            code: refCode.code,
            referrerName: refCode.user.name || "A Supermind User",
            bonusCredits: config.refereeRewardCredits,
        };
    }

    /**
     * Apply referral code during account setup for a referee
     */
    public async applyReferralCode(refereeUserId: string, code: string) {
        const normalizedCode = code.trim().toUpperCase();
        await this.validateReferralCode(normalizedCode, refereeUserId);

        const refCode = await db.referralCode.findUnique({
            where: { code: normalizedCode },
        });

        if (!refCode) {
            throw new APIError(httpStatus.NOT_FOUND, "Referral code not found");
        }

        // Check if referee already applied a referral code
        const existingReferral = await db.referral.findUnique({
            where: { refereeId: refereeUserId },
        });

        if (existingReferral) {
            throw new APIError(httpStatus.BAD_REQUEST, "You have already applied a referral code");
        }

        const config = (await db.referralConfig.findUnique({ where: { id: "default" } })) || {
            referrerRewardCredits: 100,
            refereeRewardCredits: 50,
            isEnabled: true,
        };

        const refereeReward = config.refereeRewardCredits || 0;

        // Create Referral Record
        const referral = await db.referral.create({
            data: {
                referrerId: refCode.userId,
                refereeId: refereeUserId,
                codeUsed: normalizedCode,
                status: "SIGNED_UP",
                refereeRewardAmount: refereeReward,
            },
        });

        // Award welcome bonus credits to Referee if configured
        if (refereeReward > 0) {
            await db.wallet.upsert({
                where: { userId: refereeUserId },
                update: { balanceCredits: { increment: refereeReward } },
                create: { userId: refereeUserId, balanceCredits: refereeReward },
            });

            await db.transaction.create({
                data: {
                    userId: refereeUserId,
                    type: "REFERRAL_CREDIT",
                    amount: refereeReward,
                    status: "SUCCESS",
                    providerReferenceId: `WELCOME_BONUS_${referral.id}`,
                },
            });
        }

        return referral;
    }

    /**
     * Triggered automatically upon successful course purchase by a referee
     */
    public async processReferralRewardOnPurchase(refereeUserId: string, purchaseAmount: number) {
        const referral = await db.referral.findUnique({
            where: { refereeId: refereeUserId },
            include: {
                referrer: {
                    select: { id: true, name: true, expoPushToken: true },
                },
                referee: {
                    select: { name: true, phoneNumber: true },
                },
            },
        });

        if (!referral || referral.status !== "SIGNED_UP") {
            return null; // Either no referral exists or already rewarded
        }

        const config = (await db.referralConfig.findUnique({ where: { id: "default" } })) || {
            referrerRewardCredits: 100,
            minPurchaseAmount: 0,
            isEnabled: true,
        };

        if (!config.isEnabled) return null;
        if (Number(config.minPurchaseAmount) > purchaseAmount) return null;

        const rewardCredits = config.referrerRewardCredits;

        // 1. Credit Referrer Wallet
        await db.wallet.upsert({
            where: { userId: referral.referrerId },
            update: { balanceCredits: { increment: rewardCredits } },
            create: { userId: referral.referrerId, balanceCredits: rewardCredits },
        });

        // 2. Add Transaction Record
        await db.transaction.create({
            data: {
                userId: referral.referrerId,
                type: "REFERRAL_CREDIT",
                amount: rewardCredits,
                status: "SUCCESS",
                providerReferenceId: `REFERRAL_REWARD_${referral.id}`,
            },
        });

        // 3. Update Referral Status to REWARDED
        const updatedReferral = await db.referral.update({
            where: { id: referral.id },
            data: {
                status: "REWARDED",
                rewardAmount: rewardCredits,
                rewardedAt: new Date(),
            },
        });

        // 4. Send Push Notification to Referrer
        const refereeName = referral.referee.name || `User (${referral.referee.phoneNumber.slice(-4)})`;
        if (referral.referrer.expoPushToken) {
            pushNotificationService.sendPushNotification({
                to: referral.referrer.expoPushToken,
                title: "🎉 Referral Reward Earned!",
                body: `Congratulations! ${refereeName} made their first purchase. You earned ${rewardCredits} credits in your wallet!`,
                data: { type: "REFERRAL_REWARD", referralId: referral.id },
            });
        }

        return updatedReferral;
    }

    /**
     * Backfill referral codes for existing users in the database who don't have one yet
     */
    public async backfillMissingReferralCodes() {
        const usersWithoutCode = await db.user.findMany({
            where: { referralCode: null },
            select: { id: true },
        });

        for (const user of usersWithoutCode) {
            let uniqueCode = "SUPER" + crypto.randomBytes(3).toString("hex").toUpperCase();
            let isDuplicate = await db.referralCode.findUnique({ where: { code: uniqueCode } });
            while (isDuplicate) {
                uniqueCode = "SUPER" + crypto.randomBytes(3).toString("hex").toUpperCase();
                isDuplicate = await db.referralCode.findUnique({ where: { code: uniqueCode } });
            }

            await db.referralCode.create({
                data: {
                    userId: user.id,
                    code: uniqueCode,
                },
            }).catch(() => {});
        }

        return { count: usersWithoutCode.length };
    }
}

export const referralService = new ReferralService();
