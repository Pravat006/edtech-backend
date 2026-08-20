import { db } from "@/config/database";
import argon2 from "argon2";
import { APIError } from "@/utils/APIError";
import httpStatus from "http-status";
import { CreateSubAdmin } from "./admin.management.schema";
import { AdminPermission } from "../../../../generated/prisma";
import { emailService } from "@/modules/email/email.service";

class AdminManagementService {
    public async createSubAdmin(data: CreateSubAdmin) {
        const existingAdmin = await db.admin.findUnique({ where: { email: data.email } });
        if (existingAdmin) {
            throw new APIError(httpStatus.CONFLICT, "Admin with this email already exists");
        }

        const hashedPassword = await argon2.hash(data.password);
        
        const newAdmin = await db.admin.create({
            data: {
                name: data.name,
                email: data.email,
                password: hashedPassword,
                role: "SUB",
                permissions: data.permissions || [],
            }
        });

        // Trigger invitation email in background (non-blocking)
        const adminFrontendUrl = process.env.ADMIN_FRONTEND_URL || "http://localhost:3001";
        emailService.sendSubAdminInvite({
            to: newAdmin.email,
            name: newAdmin.name,
            acceptUrl: `${adminFrontendUrl}/accept-invite?token=${newAdmin.id}`,
            permissions: newAdmin.permissions as string[],
        }).catch((err) => {
            console.error("[AdminManagementService] Error sending sub-admin invite:", err);
        });

        const { password, ...safeAdmin } = newAdmin;
        return safeAdmin;
    }

    public async listSubAdmins() {
        return await db.admin.findMany({
            where: { role: "SUB" },
            select: { id: true, name: true, email: true, role: true, permissions: true, createdAt: true, updatedAt: true }
        });
    }

    public async updateSubAdminPermissions(id: string, permissions: AdminPermission[]) {
        const target = await db.admin.findUnique({ where: { id } });
        if (!target) throw new APIError(httpStatus.NOT_FOUND, "Sub-admin not found");
        if (target.role === "SUPER") throw new APIError(httpStatus.FORBIDDEN, "Cannot alter permissions of a SUPER admin");

        const updated = await db.admin.update({
            where: { id },
            data: { permissions },
            select: { id: true, name: true, email: true, role: true, permissions: true, updatedAt: true }
        });

        return updated;
    }

    public async revokeSubAdmin(id: string) {
        const target = await db.admin.findUnique({ where: { id } });
        if (!target) throw new APIError(httpStatus.NOT_FOUND, "Sub-admin not found");
        if (target.role === "SUPER") throw new APIError(httpStatus.FORBIDDEN, "Cannot delete a SUPER admin");

        await db.admin.delete({ where: { id } });
        return true;
    }
}

export const adminManagementService = new AdminManagementService();
