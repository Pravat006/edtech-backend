import { z } from "zod";

export const AdminLoginSchema = z.strictObject({
    email: z.string().email("Invalid email format"),
    password: z.string().min(6, "Password must be at least 6 characters"),
});
export type AdminLogin = z.infer<typeof AdminLoginSchema>;

export const AdminAcceptInviteSchema = z.strictObject({
    token: z.string().min(1, "Invitation token is required"),
    password: z.string().min(8, "Password must be at least 8 characters"),
});
export type AdminAcceptInvite = z.infer<typeof AdminAcceptInviteSchema>;

