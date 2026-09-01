import { z } from "zod";

const phoneRegex = /^\+?[1-9]\d{1,14}$/;

// 1. Step 1: Send OTP for Account Creation / Login
export const SendOtpSchema = z.strictObject({
    phoneNumber: z
        .string()
        .min(10, "Phone number must be at least 10 digits").max(20)
        .regex(phoneRegex, "Invalid phone format"),
});
export type SendOtp = z.infer<typeof SendOtpSchema>;

// 2. Step 2: Verify OTP
export const VerifyOtpSchema = z.strictObject({
    phoneNumber: z
        .string()
        .min(10, "Phone number must be at least 10 digits")
        .regex(phoneRegex, "Invalid phone format"),
    otp: z.string().length(6, "OTP must be exactly 6 digits"),
});
export type VerifyOtp = z.infer<typeof VerifyOtpSchema>;

// 3. Step 3: Set up Profile (Name & Email)
export const ProfileSetupSchema = z.strictObject({
    name: z.string().min(2, "Name must be at least 2 characters long").max(100, "Name too long"),
    email: z.string().email("Invalid email format").max(255, "Email too long"),
});
export type ProfileSetup = z.infer<typeof ProfileSetupSchema>;

// 4. Step 4: User Preferences (Goals, Subjects, Language)
export const UserPreferencesSchema = z.strictObject({
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
export const RefreshTokenSchema = z.strictObject({
    token: z.string().min(1, "Refresh token is required").max(2048, "Token too long"),
});
export type RefreshToken = z.infer<typeof RefreshTokenSchema>;

// 5. Login with Password
export const LoginSchema = z.strictObject({
    phoneNumber: z
        .string()
        .min(10, "Phone number must be at least 10 digits")
        .max(20)
        .regex(phoneRegex, "Invalid phone format"),
    password: z.string().min(6, "Password must be at least 6 characters").max(100, "Password too long"),
});
export type Login = z.infer<typeof LoginSchema>;

// 6. Set / Reset Password
export const SetPasswordSchema = z.strictObject({
    setupToken: z.string().min(1, "Setup token is required").max(1024, "Token too long"),
    password: z.string().min(6, "Password must be at least 6 characters").max(100, "Password too long"),
});
export type SetPassword = z.infer<typeof SetPasswordSchema>;

// 7. Change Password (Authenticated)
export const ChangePasswordSchema = z.strictObject({
    oldPassword: z.string().min(6, "Old password must be at least 6 characters").max(100, "Password too long"),
    newPassword: z.string().min(6, "New password must be at least 6 characters").max(100, "Password too long"),
});
export type ChangePassword = z.infer<typeof ChangePasswordSchema>;

