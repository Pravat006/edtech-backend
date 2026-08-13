import { z } from "zod";
import { UserUpdateSchema } from "./schema";

// User auth schemas have been moved to src/modules/auth/auth.schema.ts

export const EmailOptionsSchema = z.object({
    to: z.string().email(),
    subject: z.string(),
    text: z.string().optional(),
    html: z.string().optional(),
});

export const SendContactForm = z.object({
    name: z.string(),
    email: z.string(),
    subject: z.string(),
    message: z.string(),
});

export const UpdateProfileSchema = UserUpdateSchema;
export const ResetPasswordSchema = z.object({
    newPassword: z
        .string()
        .min(8, "New password must be at least 8 characters"),
    token: z.string().min(1, "Token is required"),
});

export const ChangePasswordSchema = z.object({
    oldPassword: z.string().min(1, "Old password is required"),
    newPassword: z
        .string()
        .min(8, "New password must be at least 8 characters"),
});

// Removed RefreshTokenSchema as it was moved to auth.schema.ts

// Query Schema for common query parameters
export const QuerySchema = z.object({
    // Pagination
    page: z.coerce.number().int().positive().default(1).optional(),
    limit: z.coerce.number().int().positive().max(100).default(10).optional(),

    // Search and filtering
    search: z.string().optional(),
    status: z.string().optional(),
    rating: z.coerce.number().int().min(1).max(5).optional(),

    // Relations
    includeRelations: z.preprocess(
        (value) => (typeof value === "string" ? value === "true" : value),
        z.boolean().default(false),
    ).optional(),

    // Sorting
    sortBy: z.string().optional(),
    sortOrder: z.enum(["asc", "desc"]).default("desc").optional(),

    // Date filtering
    startDate: z.string().datetime().optional(),
    endDate: z.string().datetime().optional(),

    // Category and other filters
    minPrice: z.coerce.number().positive().optional(),
    maxPrice: z.coerce.number().positive().optional(),
});
// Admin auth schemas removed as per instruction

export type Query = z.infer<typeof QuerySchema>;
export type SendContactForm = z.infer<typeof SendContactForm>;
export type EmailInterface = z.infer<typeof EmailOptionsSchema>;
export type UpdateProfile = z.infer<typeof UpdateProfileSchema>;
export type ChangePassword = z.infer<typeof ChangePasswordSchema>;
