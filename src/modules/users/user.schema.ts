import { z } from "zod";
export const SubjectEnum = z.string().max(100);
export const GoalEnum = z.string().max(100);

export type Subject = string;
export type Goal = string;

export const UpdateProfileSchema = z.strictObject({
    name: z.string().min(2, "Name must be at least 2 characters").max(100, "Name too long").optional(),
    email: z.string().email("Invalid email format").max(255, "Email too long").optional(),
    avatarMediaId: z.string().uuid("Invalid avatar media ID").optional(),
});

export type UpdateProfile = z.infer<typeof UpdateProfileSchema>;

export const UpdatePreferencesSchema = z.strictObject({
    language: z.string().min(2).max(10).optional(),
    subjects: z.array(SubjectEnum).max(50, "Too many subjects").optional(),
    goals: z.array(GoalEnum).max(50, "Too many goals").optional(),
});
export type UpdatePreferences = z.infer<typeof UpdatePreferencesSchema>;

export const RequestPhoneChangeSchema = z.strictObject({
    newPhoneNumber: z.string().min(10, "Phone number must be at least 10 digits").max(20),
});
export type RequestPhoneChange = z.infer<typeof RequestPhoneChangeSchema>;

export const VerifyPhoneChangeSchema = z.strictObject({
    newPhoneNumber: z.string().min(10, "Phone number must be at least 10 digits").max(20),
    code: z.string().min(4, "OTP code must be at least 4 digits").max(10),
});
export type VerifyPhoneChange = z.infer<typeof VerifyPhoneChangeSchema>;

export const RequestEmailChangeSchema = z.strictObject({
    newEmail: z.string().email("Invalid email address").max(255),
});
export type RequestEmailChange = z.infer<typeof RequestEmailChangeSchema>;

export const VerifyEmailChangeSchema = z.strictObject({
    newEmail: z.string().email("Invalid email address").max(255),
    code: z.string().min(4, "OTP code must be at least 4 digits").max(10),
});
export type VerifyEmailChange = z.infer<typeof VerifyEmailChangeSchema>;

export const InitiateAccountDeletionSchema = z.strictObject({
    credential: z.string().min(3, "Email or phone credential is required").max(255),
    password: z.string().min(1, "Password is required for deletion verification").max(100),
});
export type InitiateAccountDeletion = z.infer<typeof InitiateAccountDeletionSchema>;

export const ConfirmAccountDeletionSchema = z.strictObject({
    credential: z.string().max(255).optional(),
    otp: z.string().length(6, "OTP code must be exactly 6 digits"),
});
export type ConfirmAccountDeletion = z.infer<typeof ConfirmAccountDeletionSchema>;

