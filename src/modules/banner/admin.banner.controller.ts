import { Request, Response, NextFunction } from "express";
import { bannerService } from "./banner.service";
import {
    createBannerSchema,
    updateBannerSchema,
    reorderBannersSchema,
    uploadBannerImageSchema,
} from "./banner.schema";
import httpStatus from "http-status";

export const getAllBannersAdminController = async (
    req: Request,
    res: Response,
    next: NextFunction
) => {
    try {
        const banners = await bannerService.getAllAdminBanners();
        res.status(httpStatus.OK).json({
            success: true,
            data: banners,
        });
    } catch (error) {
        next(error);
    }
};

export const getBannerByIdAdminController = async (
    req: Request,
    res: Response,
    next: NextFunction
) => {
    try {
        const { id } = req.params;
        const banner = await bannerService.getBannerById(id);
        res.status(httpStatus.OK).json({
            success: true,
            data: banner,
        });
    } catch (error) {
        next(error);
    }
};

export const createBannerAdminController = async (
    req: Request,
    res: Response,
    next: NextFunction
) => {
    try {
        const validatedData = createBannerSchema.parse(req.body);
        const adminId = (req as any).admin?.id;
        const banner = await bannerService.createBanner(validatedData, adminId);
        res.status(httpStatus.CREATED).json({
            success: true,
            message: "Banner created successfully",
            data: banner,
        });
    } catch (error) {
        next(error);
    }
};

export const updateBannerAdminController = async (
    req: Request,
    res: Response,
    next: NextFunction
) => {
    try {
        const { id } = req.params;
        const validatedData = updateBannerSchema.parse(req.body);
        const banner = await bannerService.updateBanner(id, validatedData);
        res.status(httpStatus.OK).json({
            success: true,
            message: "Banner updated successfully",
            data: banner,
        });
    } catch (error) {
        next(error);
    }
};

export const deleteBannerAdminController = async (
    req: Request,
    res: Response,
    next: NextFunction
) => {
    try {
        const { id } = req.params;
        const result = await bannerService.deleteBanner(id);
        res.status(httpStatus.OK).json(result);
    } catch (error) {
        next(error);
    }
};

export const reorderBannersAdminController = async (
    req: Request,
    res: Response,
    next: NextFunction
) => {
    try {
        const validatedData = reorderBannersSchema.parse(req.body);
        const result = await bannerService.reorderBanners(validatedData);
        res.status(httpStatus.OK).json(result);
    } catch (error) {
        next(error);
    }
};

export const uploadBannerImageAdminController = async (
    req: Request,
    res: Response,
    next: NextFunction
) => {
    try {
        const validatedData = uploadBannerImageSchema.parse(req.body);
        const result = await bannerService.uploadBannerImage(
            validatedData.file,
            validatedData.fileName
        );
        res.status(httpStatus.OK).json({
            success: true,
            message: "Banner image uploaded successfully",
            data: result,
        });
    } catch (error) {
        next(error);
    }
};
