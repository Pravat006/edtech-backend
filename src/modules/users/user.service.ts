import { db } from "@/config/database";
import httpStatus from "http-status";
import { APIError } from "@/utils/APIError";
import { UpdateProfile, UpdatePreferences } from "./user.schema";

class UserService {
    public async getProfile(userId: string) {
        const user = await db.user.findUnique({
            where: { id: userId },
            include: {
                referralCode: true,
                wallet: true,
                avatar: true,
                preferences: true,
            }
        });
        if (!user) throw new APIError(httpStatus.NOT_FOUND, "User not found");
        
        // Hide sensitive fields before returning
        const { ...safeUser } = user;
        return safeUser;
    }

    public async updateProfile(userId: string, data: UpdateProfile) {
        return await db.user.update({
            where: { id: userId },
            data,
            include: { avatar: true }
        });
    }

    public async getPreferences(userId: string) {
        return await db.userPreferences.findUnique({
            where: { userId }
        });
    }

    public async updatePreferences(userId: string, data: UpdatePreferences) {
        // Prisma $Enums.Goal is incompatible with our local Goal string union —
        // we build the payload separately so the upsert args are fully typed.
        const subjects = (data.subjects ?? []) as unknown[];
        const goals = (data.goals ?? []) as unknown[];

        return await db.userPreferences.upsert({
            where: { userId },
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            update: { language: data.language, subjects: subjects as any, goals: goals as any },
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            create: { userId, language: data.language || "en", subjects: subjects as any, goals: goals as any },
        });
    }

    public async getWallet(userId: string) {
        const wallet = await db.wallet.findUnique({
            where: { userId }
        });
        const transactions = await db.transaction.findMany({
            where: { userId }
        });
        return { wallet, transactions };
    }

    public async getReferrals(userId: string) {
        return await db.referral.findMany({
            where: { referrerId: userId },
            include: { referee: { select: { name: true, phoneNumber: true } } }
        });
    }
}

export const userServiceModule = new UserService();
