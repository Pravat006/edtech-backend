import { Request, Response } from "express";
import httpStatus from "http-status";
import { CreateSubAdmin } from "./admin.management.schema";
import { adminManagementService } from "./admin.management.service";

export const createSubAdmin = async (req: Request, res: Response) => {
    const data = req.body as CreateSubAdmin;
    const admin = await adminManagementService.createSubAdmin(data);

    res.status(httpStatus.CREATED).json({
        success: true,
        message: "Sub-admin created successfully",
        data: admin,
    });
};

export const listSubAdmins = async (req: Request, res: Response) => {
    const { status, search, page, limit } = req.query;
    const result = await adminManagementService.listSubAdmins({
        status: status as any,
        search: search as string,
        page: page ? parseInt(page as string, 10) : 1,
        limit: limit ? parseInt(limit as string, 10) : 10,
    });
    res.status(httpStatus.OK).json({ success: true, ...result });
};

export const updateSubAdminPermissions = async (req: Request, res: Response) => {
    const { id } = req.params;
    const { permissions } = req.body;
    const updated = await adminManagementService.updateSubAdminPermissions(id, permissions);

    res.status(httpStatus.OK).json({
        success: true,
        message: "Sub-admin permissions updated successfully",
        data: updated,
    });
};

export const deactivateSubAdmin = async (req: Request, res: Response) => {
    const { id } = req.params;
    const superAdminId = req.admin!.id;
    const result = await adminManagementService.deactivateSubAdmin(superAdminId, id);

    res.status(httpStatus.OK).json(result);
};

export const activateSubAdmin = async (req: Request, res: Response) => {
    const { id } = req.params;
    const superAdminId = req.admin!.id;
    const result = await adminManagementService.activateSubAdmin(superAdminId, id);

    res.status(httpStatus.OK).json(result);
};

export const reassignSubAdmin = async (req: Request, res: Response) => {
    const { id } = req.params;
    const superAdminId = req.admin!.id;
    const result = await adminManagementService.reassignSubAdmin(superAdminId, id, req.body);

    res.status(httpStatus.OK).json(result);
};
