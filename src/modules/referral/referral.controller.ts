import { Request, Response } from "express";
import httpStatus from "http-status";
import { referralService } from "./referral.service";

class ReferralController {
    public getDashboard = async (req: Request, res: Response): Promise<void> => {
        const userId = req.user!.id;
        const dashboard = await referralService.getUserReferralDashboard(userId);
        res.status(httpStatus.OK).json({
            success: true,
            data: dashboard,
        });
    };

    public validateCode = async (req: Request, res: Response): Promise<void> => {
        const { code } = req.body;
        const userId = req.user?.id;
        const result = await referralService.validateReferralCode(code, userId);
        res.status(httpStatus.OK).json({
            success: true,
            data: result,
        });
    };

    public applyCode = async (req: Request, res: Response): Promise<void> => {
        const userId = req.user!.id;
        const { code } = req.body;
        const referral = await referralService.applyReferralCode(userId, code);
        res.status(httpStatus.OK).json({
            success: true,
            message: "Referral code applied successfully!",
            data: referral,
        });
    };
}

export const referralController = new ReferralController();
