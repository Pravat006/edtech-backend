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
    const admins = await adminManagementService.listSubAdmins();
    res.status(httpStatus.OK).json({ success: true, data: admins });
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

export const revokeSubAdmin = async (req: Request, res: Response) => {
    const { id } = req.params;
    await adminManagementService.revokeSubAdmin(id);

    res.status(httpStatus.OK).json({
        success: true,
        message: "Sub-admin access revoked",
    });
};
