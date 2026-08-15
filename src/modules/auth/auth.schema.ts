import { z } from "zod";

const phoneRegex = /^\+?[1-9]\d{1,14}$/;

// 1. Step 1: Send OTP for Account Creation / Login
export const SendOtpSchema = z.object({
    phoneNumber: z
        .string()
        .min(10, "Phone number must be at least 10 digits")
        .regex(phoneRegex, "Invalid phone format"),
});
export type SendOtp = z.infer<typeof SendOtpSchema>;

// 2. Step 2: Verify OTP
export const VerifyOtpSchema = z.object({
    phoneNumber: z
        .string()
        .min(10, "Phone number must be at least 10 digits")
        .regex(phoneRegex, "Invalid phone format"),
    otp: z.string().min(4, "OTP is required"),
});
export type VerifyOtp = z.infer<typeof VerifyOtpSchema>;

// 3. Step 3: Set up Profile (Name & Email)
export const ProfileSetupSchema = z.object({
    name: z.string().min(2, "Name must be at least 2 characters long"),
    email: z.string().email("Invalid email format"),
});
export type ProfileSetup = z.infer<typeof ProfileSetupSchema>;

// 4. Step 4: User Preferences (Goals, Subjects, Language)
export const UserPreferencesSchema = z.object({
    language: z.string().min(2, "Language is required"),
    subjects: z
        .array(z.enum(["ENGINEERING", "ARTS", "SCIENCE", "MATH", "COMMERCE", "OTHER"]))
        .min(1, "At least one subject is required"),
    goals: z
        .array(z.enum(["POPULAR_EXAMS", "GOVERNMENT_EXAMS", "ACADEMIC", "SKILL_BASED"]))
        .min(1, "At least one goal is required"),
});
export type UserPreferencesInput = z.infer<typeof UserPreferencesSchema>;

// Auth Utility Schemas
export const RefreshTokenSchema = z.object({
    token: z.string().min(1, "Refresh token is required"),
});
export type RefreshToken = z.infer<typeof RefreshTokenSchema>;

// 5. Login with Password
export const LoginSchema = z.object({
    phoneNumber: z
        .string()
        .min(10, "Phone number must be at least 10 digits")
        .regex(phoneRegex, "Invalid phone format"),
    password: z.string().min(6, "Password must be at least 6 characters"),
});
export type Login = z.infer<typeof LoginSchema>;

// 6. Set / Reset Password
export const SetPasswordSchema = z.object({
    setupToken: z.string().min(1, "Setup token is required"),
    password: z.string().min(6, "Password must be at least 6 characters"),
});
export type SetPassword = z.infer<typeof SetPasswordSchema>;

// 7. Change Password (Authenticated)
export const ChangePasswordSchema = z.object({
    oldPassword: z.string().min(6, "Old password must be at least 6 characters"),
    newPassword: z.string().min(6, "New password must be at least 6 characters"),
});
export type ChangePassword = z.infer<typeof ChangePasswordSchema>;

