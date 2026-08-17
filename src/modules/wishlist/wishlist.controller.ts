import { Request, Response } from "express";
import httpStatus from "http-status";
import { wishlistService } from "./wishlist.service";

/**
 * GET /v1/wishlist
 */
export const getWishlist = async (req: Request, res: Response) => {
    const userId = req.user!.id;
    const data = await wishlistService.getWishlist(userId);
    res.status(httpStatus.OK).json({ success: true, data });
};

/**
 * POST /v1/wishlist/:courseId
 */
export const addToWishlist = async (req: Request, res: Response) => {
    const userId = req.user!.id;
    const { courseId } = req.params;
    await wishlistService.addToWishlist(userId, courseId);
    res.status(httpStatus.OK).json({
        success: true,
        message: "Course added to wishlist.",
    });
};

/**
 * DELETE /v1/wishlist/:courseId
 */
export const removeFromWishlist = async (req: Request, res: Response) => {
    const userId = req.user!.id;
    const { courseId } = req.params;
    await wishlistService.removeFromWishlist(userId, courseId);
    res.status(httpStatus.OK).json({
        success: true,
        message: "Course removed from wishlist.",
    });
};

/**
 * GET /v1/wishlist/:courseId/check
 */
export const checkWishlist = async (req: Request, res: Response) => {
    const userId = req.user!.id;
    const { courseId } = req.params;
    const data = await wishlistService.isWishlisted(userId, courseId);
    res.status(httpStatus.OK).json({ success: true, data });
};
