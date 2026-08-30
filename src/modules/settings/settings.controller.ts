import { Request, Response } from "express";
import httpStatus from "http-status";
import { SettingsService } from "./settings.service";

export class SettingsController {
    // --- Public Endpoints ---
    static async getPublicSettings(req: Request, res: Response) {
        // e.g. ?keys=PLATFORM_NAME,LOGO_URL
        const keys = req.query.keys ? (req.query.keys as string).split(",") : undefined;
        const settings = await SettingsService.getPlatformSettings(keys);
        res.status(httpStatus.OK).json({ success: true, message: "Platform settings fetched", data: settings });
    }

    static async getPublicCategories(req: Request, res: Response) {
        const categories = await SettingsService.getCategoryConfigs(true);
        res.status(httpStatus.OK).json({ success: true, message: "Categories fetched", data: categories });
    }

    // --- Admin Endpoints ---
    static async getAdminSettings(req: Request, res: Response) {
        const settings = await SettingsService.getPlatformSettings();
        res.status(httpStatus.OK).json({ success: true, message: "Platform settings fetched", data: settings });
    }

    static async upsertAdminSettings(req: Request, res: Response) {
        const adminId = req.user!.id;
        const settings = await SettingsService.upsertPlatformSettings(req.body, adminId);
        res.status(httpStatus.OK).json({ success: true, message: "Platform settings updated", data: settings });
    }

    static async getAdminCategories(req: Request, res: Response) {
        const categories = await SettingsService.getCategoryConfigs(false);
        res.status(httpStatus.OK).json({ success: true, message: "Categories fetched", data: categories });
    }

    static async createCategory(req: Request, res: Response) {
        const category = await SettingsService.createCategoryConfig(req.body);
        res.status(httpStatus.CREATED).json({ success: true, message: "Category created successfully", data: category });
    }

    static async updateCategory(req: Request, res: Response) {
        const { id } = req.params;
        const category = await SettingsService.updateCategoryConfig(id, req.body);
        res.status(httpStatus.OK).json({ success: true, message: "Category updated successfully", data: category });
    }

    static async deleteCategory(req: Request, res: Response) {
        const { id } = req.params;
        await SettingsService.deleteCategoryConfig(id);
        res.status(httpStatus.OK).json({ success: true, message: "Category deleted successfully" });
    }
}
