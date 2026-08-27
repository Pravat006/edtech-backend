import { Request, Response, NextFunction } from "express";
import httpStatus from "http-status";
import { cmsService } from "@/modules/content/cms.service";
import { CreateCmsPageSchema, UpdateCmsPageSchema } from "@/modules/content/cms.schema";

export const getAllPagesAdmin = async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const pages = await cmsService.getAllPagesAdmin();
    res.status(httpStatus.OK).json({
      success: true,
      message: "CMS pages retrieved successfully",
      data: pages,
    });
  } catch (error) {
    next(error);
  }
};

export const getPageByIdAdmin = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const page = await cmsService.getPageByIdAdmin(id as string);
    res.status(httpStatus.OK).json({
      success: true,
      message: "CMS page details retrieved successfully",
      data: page,
    });
  } catch (error) {
    next(error);
  }
};

export const createPageAdmin = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const input = CreateCmsPageSchema.parse(req.body);
    const adminId = req.admin!.id;
    const page = await cmsService.createPageAdmin(input, adminId);
    res.status(httpStatus.CREATED).json({
      success: true,
      message: `CMS page '${page.title}' created successfully`,
      data: page,
    });
  } catch (error) {
    next(error);
  }
};

export const updatePageAdmin = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const input = UpdateCmsPageSchema.parse(req.body);
    const adminId = req.admin!.id;
    const page = await cmsService.updatePageAdmin(id as string, input, adminId);
    res.status(httpStatus.OK).json({
      success: true,
      message: `CMS page '${page.title}' updated successfully`,
      data: page,
    });
  } catch (error) {
    next(error);
  }
};

export const revertPageAdmin = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id, revisionId } = req.params;
    const adminId = req.admin!.id;
    const page = await cmsService.revertPageAdmin(id as string, revisionId as string, adminId);
    res.status(httpStatus.OK).json({
      success: true,
      message: `CMS page '${page.title}' reverted successfully to revision version ${page.version}`,
      data: page,
    });
  } catch (error) {
    next(error);
  }
};

export const deletePageAdmin = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const result = await cmsService.deletePageAdmin(id as string);
    res.status(httpStatus.OK).json({
      success: true,
      message: result.message,
      data: null,
    });
  } catch (error) {
    next(error);
  }
};

export const togglePageStatusAdmin = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const { isPublished } = req.body;
    const result = await cmsService.togglePageStatusAdmin(id as string, Boolean(isPublished));
    res.status(httpStatus.OK).json({
      success: true,
      message: result.message,
      data: result.data,
    });
  } catch (error) {
    next(error);
  }
};
