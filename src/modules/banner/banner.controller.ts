import { Request, Response, NextFunction } from "express";
import { bannerService } from "./banner.service";
import httpStatus from "http-status";

/**
 * Public controller to get active home screen banners for students
 */
export const getPublicBannersController = async (
    req: Request,
    res: Response,
    next: NextFunction
) => {
    try {
        const banners = await bannerService.getPublicBanners();
        res.status(httpStatus.OK).json({
            success: true,
            data: banners,
        });
    } catch (error) {
        next(error);
    }
};
