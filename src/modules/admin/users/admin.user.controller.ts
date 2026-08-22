import { Request, Response, NextFunction } from "express";
import httpStatus from "http-status";
import * as userService from "./admin.user.service";

export const listUsers = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { page, limit, search, status } = req.query;
        const result = await userService.listUsers({
            page: page ? Number(page) : undefined,
            limit: limit ? Number(limit) : undefined,
            search: search ? String(search) : undefined,
            status: status as any,
        });

        res.status(httpStatus.OK).json({
            success: true,
            data: result.users,
            pagination: result.pagination,
        });
    } catch (error) {
        next(error);
    }
};

export const getUserById = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { userId } = req.params;
        const user = await userService.getUserById(userId);

        res.status(httpStatus.OK).json({
            success: true,
            data: user,
        });
    } catch (error) {
        next(error);
    }
};

export const manualEnrollUser = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { userId } = req.params;
        const { courseId, accessDurationDays } = req.body;

        if (!courseId) {
            res.status(httpStatus.BAD_REQUEST).json({
                success: false,
                message: "courseId is required for manual enrollment.",
            });
            return;
        }

        const enrollment = await userService.manualEnrollUser(
            userId,
            courseId,
            accessDurationDays ? Number(accessDurationDays) : undefined
        );

        res.status(httpStatus.CREATED).json({
            success: true,
            message: "Student successfully enrolled into course.",
            data: enrollment,
        });
    } catch (error) {
        next(error);
    }
};
