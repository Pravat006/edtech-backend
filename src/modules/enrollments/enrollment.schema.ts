import { z } from "zod";

export const ManualEnrollmentSchema = z.object({
    userId: z.string().uuid("Invalid user ID"),
    courseId: z.string().uuid("Invalid course ID"),
    reason: z.string().trim().optional(),
});

export type ManualEnrollment = z.infer<typeof ManualEnrollmentSchema>;

export const RevokeEnrollmentSchema = z.object({
    reason: z.string().min(3, "Revocation reason is required"),
    refund: z.boolean().default(false),
});

export type RevokeEnrollment = z.infer<typeof RevokeEnrollmentSchema>;

export const EnrollmentQuerySchema = z.object({
    status: z.enum(["ACTIVE", "COMPLETED", "CANCELLED", "REFUNDED", "EXPIRED"]).optional(),
    cursor: z.string().uuid().optional(),
    limit: z.coerce.number().int().min(1).max(50).default(20),
});

export type EnrollmentQuery = z.infer<typeof EnrollmentQuerySchema>;

export const AdminEnrollmentQuerySchema = z.object({
    status: z.enum(["ACTIVE", "COMPLETED", "CANCELLED", "REFUNDED", "EXPIRED"]).optional(),
    courseId: z.string().uuid().optional(),
    userId: z.string().uuid().optional(),
    search: z.string().trim().optional(),
    cursor: z.string().uuid().optional(),
    limit: z.coerce.number().int().min(1).max(50).default(20),
});

export type AdminEnrollmentQuery = z.infer<typeof AdminEnrollmentQuerySchema>;
