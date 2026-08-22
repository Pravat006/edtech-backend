import { Request, Response } from "express";
import httpStatus from "http-status";
import { adminReferralService } from "./admin.referral.service";

class AdminReferralController {
    public getStats = async (req: Request, res: Response): Promise<void> => {
        const stats = await adminReferralService.getStats();
        res.status(httpStatus.OK).json({
            success: true,
            data: stats,
        });
    };

    public getReferrals = async (req: Request, res: Response): Promise<void> => {
        const page = req.query.page ? parseInt(req.query.page as string, 10) : 1;
        const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 20;
        const status = req.query.status as string;
        const search = req.query.search as string;

        const result = await adminReferralService.getReferralsList({ page, limit, status, search });
        res.status(httpStatus.OK).json({
            success: true,
            data: result.referrals,
            pagination: result.pagination,
        });
    };

    public getConfig = async (req: Request, res: Response): Promise<void> => {
        const config = await adminReferralService.getReferralConfig();
        res.status(httpStatus.OK).json({
            success: true,
            data: config,
        });
    };

    public updateConfig = async (req: Request, res: Response): Promise<void> => {
        const config = await adminReferralService.updateReferralConfig(req.body);
        res.status(httpStatus.OK).json({
            success: true,
            message: "Referral settings updated successfully",
            data: config,
        });
    };

    public overrideReward = async (req: Request, res: Response): Promise<void> => {
        const { referralId } = req.params;
        const result = await adminReferralService.overrideReward(referralId);
        res.status(httpStatus.OK).json({
            success: true,
            message: "Referral reward processed successfully",
            data: result,
        });
    };
}

export const adminReferralController = new AdminReferralController();
