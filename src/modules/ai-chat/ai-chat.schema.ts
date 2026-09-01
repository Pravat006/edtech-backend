import { z } from "zod";

export const CreateConversationSchema = z.strictObject({
    courseId: z.string().optional(),
    lessonId: z.string().optional(),
    title: z.string().max(100).optional(),
});

export const AskDoubtSchema = z.strictObject({
    courseId: z.string().optional(),
    lessonId: z.string().optional(),
    conversationId: z.string().optional(),
    message: z
        .string()
        .trim()
        .min(1, "message cannot be empty")
        .max(3000, "message cannot exceed 3000 characters"),
    queryType: z.enum(["quick", "detailed"]).optional().default("detailed"),
});
