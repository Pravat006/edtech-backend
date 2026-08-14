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
