import { Request, Response } from "express";
import httpStatus from "http-status";
import { adminAIChatService } from "./admin-ai-chat.service";

export class AdminAIChatController {
    public getAllPackages = async (req: Request, res: Response) => {
        const packages = await adminAIChatService.getAllPackages();
        res.status(httpStatus.OK).json({
            success: true,
            data: packages,
        });
    };

    public createPackage = async (req: Request, res: Response) => {
        const { name, price, credits, bonusCredits, description, popular } = req.body;
        const newPackage = await adminAIChatService.createPackage({
            name,
            price: Number(price),
            credits: Number(credits),
            bonusCredits: bonusCredits ? Number(bonusCredits) : 0,
            description,
            popular: Boolean(popular),
        });

        res.status(httpStatus.CREATED).json({
            success: true,
            message: "AI Credit Package created successfully",
            data: newPackage,
        });
    };

    public updatePackage = async (req: Request, res: Response) => {
        const { id } = req.params;
        const updated = await adminAIChatService.updatePackage(id, req.body);
        res.status(httpStatus.OK).json({
            success: true,
            message: "AI Credit Package updated successfully",
            data: updated,
        });
    };

    public togglePackageStatus = async (req: Request, res: Response) => {
        const { id } = req.params;
        const updated = await adminAIChatService.togglePackageStatus(id);
        res.status(httpStatus.OK).json({
            success: true,
            message: `AI Credit Package ${updated.isActive ? "activated" : "deactivated"} successfully`,
            data: updated,
        });
    };

    public deletePackage = async (req: Request, res: Response) => {
        const { id } = req.params;
        const result = await adminAIChatService.deletePackage(id);
        res.status(httpStatus.OK).json({
            success: true,
            message: result.message,
        });
    };

    public getAnalytics = async (req: Request, res: Response) => {
        const analytics = await adminAIChatService.getAIAnalytics();
        res.status(httpStatus.OK).json({
            success: true,
            data: analytics,
        });
    };

    public grantPromotionalCredits = async (req: Request, res: Response) => {
        const { userId, email, userIdentifier, user, credits, reason } = req.body;
        const targetIdentifier = userId || email || userIdentifier || user;

        const result = await adminAIChatService.grantPromotionalCredits(
            targetIdentifier,
            Number(credits),
            reason
        );

        res.status(httpStatus.OK).json({
            success: true,
            message: result.message,
            data: result.wallet,
        });
    };
}

export const adminAIChatController = new AdminAIChatController();
