import { db } from "@/config/database";
import argon2 from "argon2";
import { APIError } from "@/utils/APIError";
import httpStatus from "http-status";
import { CreateSubAdmin } from "./admin.management.schema";
import { AdminPermission } from "../../../../generated/prisma";
import { emailService } from "@/modules/email/email.service";
import envVars from "@/config/envVars";

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
                isActive: true,
                permissions: data.permissions || [],
            }
        });
        const rawUrl = envVars.ADMIN_FRONTEND_URL || envVars.ADMIN_ORIGIN || "http://localhost:3001";
        const adminFrontendUrl = rawUrl.replace(/\/$/, "");

        try {
            await emailService.sendSubAdminInvite({
                to: newAdmin.email,
                name: newAdmin.name,
                acceptUrl: `${adminFrontendUrl}/accept-invite?token=${newAdmin.id}`,
                permissions: newAdmin.permissions as string[],
            });
        } catch (err) {
            console.error("[AdminManagementService] Error sending sub-admin invite:", err);
        }

        const { password, ...safeAdmin } = newAdmin;
        return safeAdmin;
    }

    public async listSubAdmins(params?: { status?: "all" | "active" | "inactive"; search?: string; page?: number; limit?: number }) {
        const page = Math.max(1, params?.page || 1);
        const limit = Math.max(1, Math.min(100, params?.limit || 10));
        const skip = (page - 1) * limit;

        const where: any = { role: "SUB" };

        if (params?.status === "active") {
            where.isActive = true;
        } else if (params?.status === "inactive") {
            where.isActive = false;
        }

        if (params?.search) {
            where.OR = [
                { name: { contains: params.search, mode: "insensitive" } },
                { email: { contains: params.search, mode: "insensitive" } },
            ];
        }

        const [total, subAdmins] = await Promise.all([
            db.admin.count({ where }),
            db.admin.findMany({
                where,
                select: {
                    id: true,
                    name: true,
                    email: true,
                    role: true,
                    isActive: true,
                    permissions: true,
                    createdAt: true,
                    updatedAt: true,
                },
                orderBy: { createdAt: "desc" },
                skip,
                take: limit,
            }),
        ]);

        return {
            subAdmins,
            pagination: {
                total,
                page,
                limit,
                totalPages: Math.ceil(total / limit) || 1,
            },
        };
    }

    public async updateSubAdminPermissions(id: string, permissions: AdminPermission[]) {
        const target = await db.admin.findUnique({ where: { id } });
        if (!target) throw new APIError(httpStatus.NOT_FOUND, "Sub-admin not found");
        if (target.role === "SUPER") throw new APIError(httpStatus.FORBIDDEN, "Cannot alter permissions of a SUPER admin");

        const updated = await db.admin.update({
            where: { id },
            data: { permissions },
            select: { id: true, name: true, email: true, role: true, isActive: true, permissions: true, updatedAt: true }
        });

        return updated;
    }

    public async deactivateSubAdmin(superAdminId: string, subAdminId: string) {
        const target = await db.admin.findUnique({ where: { id: subAdminId } });
        if (!target) throw new APIError(httpStatus.NOT_FOUND, "Sub-admin not found");
        if (target.role === "SUPER") {
            throw new APIError(httpStatus.BAD_REQUEST, "Super Admin account cannot be deactivated.");
        }
        if (superAdminId === subAdminId) {
            throw new APIError(httpStatus.BAD_REQUEST, "Cannot deactivate your own administrator account.");
        }

        // Soft deactivation
        await db.admin.update({
            where: { id: subAdminId },
            data: { isActive: false },
        });

        // Reassign all open / in_progress support tickets back to unassigned queue
        await db.supportTicket.updateMany({
            where: { assignedAdminId: subAdminId, status: { in: ["OPEN", "IN_PROGRESS"] } },
            data: { assignedAdminId: null },
        });

        // Revoke Redis token session
        const { redis } = await import("@/config/redis");
        await redis.deleteValue(`admin:${subAdminId}`);

        return {
            success: true,
            message: `Sub-admin '${target.name}' has been deactivated. Open support tickets reassigned to unassigned queue.`,
        };
    }

    public async activateSubAdmin(superAdminId: string, subAdminId: string) {
        const target = await db.admin.findUnique({ where: { id: subAdminId } });
        if (!target) throw new APIError(httpStatus.NOT_FOUND, "Sub-admin not found");
        if (target.role === "SUPER") {
            throw new APIError(httpStatus.BAD_REQUEST, "Super Admin account cannot be altered here.");
        }

        await db.admin.update({
            where: { id: subAdminId },
            data: { isActive: true },
        });

        return {
            success: true,
            message: `Sub-admin '${target.name}' has been reactivated.`,
        };
    }

    public async reassignSubAdmin(
        superAdminId: string,
        subAdminId: string,
        data: { name: string; email: string; password?: string; permissions?: AdminPermission[] }
    ) {
        const target = await db.admin.findUnique({ where: { id: subAdminId } });
        if (!target) throw new APIError(httpStatus.NOT_FOUND, "Sub-admin account seat not found");
        if (target.role === "SUPER") {
            throw new APIError(httpStatus.BAD_REQUEST, "Super Admin account cannot be reassigned.");
        }

        const cleanEmail = data.email.toLowerCase().trim();
        const existingEmail = await db.admin.findFirst({
            where: {
                email: cleanEmail,
                NOT: { id: subAdminId },
            },
        });

        if (existingEmail) {
            throw new APIError(httpStatus.CONFLICT, `Email '${cleanEmail}' is already assigned to another admin account.`);
        }

        const updateData: any = {
            name: data.name,
            email: cleanEmail,
            isActive: true, // Auto-reactivate seat for replacement staff
        };

        if (data.password) {
            updateData.password = await argon2.hash(data.password);
        }

        if (data.permissions) {
            updateData.permissions = data.permissions;
        }

        const updated = await db.admin.update({
            where: { id: subAdminId },
            data: updateData,
            select: {
                id: true,
                name: true,
                email: true,
                role: true,
                isActive: true,
                permissions: true,
                updatedAt: true,
            },
        });

        // Flush old session cache in Redis
        const { redis } = await import("@/config/redis");
        await redis.deleteValue(`admin:${subAdminId}`);

        return {
            success: true,
            message: `Sub-admin account seat successfully reassigned to '${updated.name}' (${updated.email}). Account reactivated.`,
            admin: updated,
        };
    }
}

export const adminManagementService = new AdminManagementService();
