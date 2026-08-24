import { Request, Response, NextFunction } from "express";
import httpStatus from "http-status";
import { cmsService } from "./cms.service";

export const getPublicPages = async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const pages = await cmsService.getPublicPages();
    res.status(httpStatus.OK).json({
      success: true,
      message: "Public static pages retrieved successfully",
      data: pages,
    });
  } catch (error) {
    next(error);
  }
};

export const getPublicPageBySlug = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { slug } = req.params;
    const page = await cmsService.getPublicPageBySlug(slug as string);
    res.status(httpStatus.OK).json({
      success: true,
      message: `Static page '${slug}' retrieved successfully`,
      data: page,
    });
  } catch (error) {
    next(error);
  }
};
