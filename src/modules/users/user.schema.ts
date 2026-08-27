import { z } from "zod";
export const SubjectEnum = z.enum([
    "ENGINEERING",
    "ARTS",
    "SCIENCE",
    "MATH",
    "COMMERCE",
    "OTHER"
]);

export const GoalEnum = z.enum([
    "CERTIFICATION",
    "KNOWLEDGE",
    "CAREER_ADVANCEMENT",
    "SKILL_BASED"
]);

export type Subject = z.infer<typeof SubjectEnum>;
export type Goal = z.infer<typeof GoalEnum>;

export const UpdateProfileSchema = z.object({
    name: z.string().min(2, "Name must be at least 2 characters").optional(),
    email: z.string().email("Invalid email format").optional(),
    avatarMediaId: z.string().uuid("Invalid avatar media ID").optional(),
});

export type UpdateProfile = z.infer<typeof UpdateProfileSchema>;

export const UpdatePreferencesSchema = z.object({
    language: z.string().min(2).optional(),
    subjects: z.array(SubjectEnum).optional(),
    goals: z.array(GoalEnum).optional(),
});
export type UpdatePreferences = z.infer<typeof UpdatePreferencesSchema>;

export const RequestPhoneChangeSchema = z.object({
    newPhoneNumber: z.string().min(10, "Phone number must be at least 10 digits"),
});
export type RequestPhoneChange = z.infer<typeof RequestPhoneChangeSchema>;

export const VerifyPhoneChangeSchema = z.object({
    newPhoneNumber: z.string().min(10, "Phone number must be at least 10 digits"),
    code: z.string().min(4, "OTP code must be at least 4 digits"),
});
export type VerifyPhoneChange = z.infer<typeof VerifyPhoneChangeSchema>;

export const RequestEmailChangeSchema = z.object({
    newEmail: z.string().email("Invalid email address"),
});
export type RequestEmailChange = z.infer<typeof RequestEmailChangeSchema>;

export const VerifyEmailChangeSchema = z.object({
    newEmail: z.string().email("Invalid email address"),
    code: z.string().min(4, "OTP code must be at least 4 digits"),
});
export type VerifyEmailChange = z.infer<typeof VerifyEmailChangeSchema>;

export const InitiateAccountDeletionSchema = z.object({
    credential: z.string().min(3, "Email or phone credential is required"),
    password: z.string().min(1, "Password is required for deletion verification"),
});
export type InitiateAccountDeletion = z.infer<typeof InitiateAccountDeletionSchema>;

export const ConfirmAccountDeletionSchema = z.object({
    credential: z.string().optional(),
    otp: z.string().length(6, "OTP code must be exactly 6 digits"),
});
export type ConfirmAccountDeletion = z.infer<typeof ConfirmAccountDeletionSchema>;

