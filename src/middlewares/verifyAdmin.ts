import { Request, Response, NextFunction } from "express";
import httpStatus from "http-status";
import { APIError } from "@/utils/APIError";
import { verifyToken, Payload } from "@/services/token.service";
import { db } from "@/config/database";

export const verifyAdmin = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const token = req.cookies?.admin_access_token;

        if (!token) {
            return next(new APIError(httpStatus.UNAUTHORIZED, "Admin session not found. Please log in."));
        }

        const decoded = verifyToken(token) as Payload;

        if (!decoded || !decoded.role) {
            return next(new APIError(httpStatus.UNAUTHORIZED, "Invalid admin token"));
        }

        const admin = await db.admin.findUnique({
            where: { id: decoded.id },
            select: { id: true, role: true, name: true, email: true, permissions: true, isActive: true }
        });

        if (!admin) {
            return next(new APIError(httpStatus.UNAUTHORIZED, "Admin account no longer exists"));
        }

        if (admin.isActive === false) {
            return next(new APIError(httpStatus.FORBIDDEN, "Your administrator account has been deactivated. Please contact Super Admin."));
        }

        req.admin = admin as any;
        next();
    } catch (error) {
        next(new APIError(httpStatus.UNAUTHORIZED, "Token expired or invalid"));
    }
};

export const requireSuperAdmin = (req: Request, res: Response, next: NextFunction) => {
    if (!req.admin) {
        return next(new APIError(httpStatus.UNAUTHORIZED, "Admin not authenticated"));
    }

    if (req.admin.role !== "SUPER") {
        return next(new APIError(httpStatus.FORBIDDEN, "Requires SUPER admin privileges"));
    }

    next();
};

export const requirePermission = (permission: string) => {
    return (req: Request, res: Response, next: NextFunction) => {
        if (!req.admin) {
            return next(new APIError(httpStatus.UNAUTHORIZED, "Admin not authenticated"));
        }
        if (req.admin.role === "SUPER") {
            return next();
        }

        const adminPermissions = (req.admin as any).permissions || [];
        if (adminPermissions.includes(permission)) {
            return next();
        }

        return next(new APIError(httpStatus.FORBIDDEN, `Missing required permission: ${permission}`));
    };
};
