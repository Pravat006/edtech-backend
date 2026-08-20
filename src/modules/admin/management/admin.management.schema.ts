import { z } from "zod";
import { AdminPermission } from "../../../../generated/prisma";

export const CreateSubAdminSchema = z.object({
    name: z.string().min(2, "Name must be at least 2 characters"),
    email: z.string().email("Invalid email format"),
    password: z.string().min(6, "Password must be at least 6 characters"),
    permissions: z.array(z.nativeEnum(AdminPermission)).optional().default([]),
});
export type CreateSubAdmin = z.infer<typeof CreateSubAdminSchema>;

export const UpdateSubAdminPermissionsSchema = z.object({
    permissions: z.array(z.nativeEnum(AdminPermission)),
});
export type UpdateSubAdminPermissions = z.infer<typeof UpdateSubAdminPermissionsSchema>;
