import { z } from "zod";

export const CourseSchema = z.object({
    title: z.string().min(1, "Title is required"),
    description: z.string().min(1, "Description is required"),
});

export type CourseInput = z.infer<typeof CourseSchema>;

