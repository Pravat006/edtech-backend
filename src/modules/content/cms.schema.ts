import { z } from "zod";

export const CreateCmsPageSchema = z.object({
  slug: z
    .string()
    .min(2, "Slug must be at least 2 characters")
    .max(100, "Slug cannot exceed 100 characters")
    .regex(/^[a-z0-9-]+$/, "Slug can only contain lowercase letters, numbers, and hyphens"),
  title: z.string().min(2, "Title must be at least 2 characters"),
  content: z.string().min(5, "Content must be at least 5 characters"),
  metaTitle: z.string().optional(),
  metaDescription: z.string().optional(),
  isPublished: z.boolean().default(true),
});

export const UpdateCmsPageSchema = z.object({
  title: z.string().min(2, "Title must be at least 2 characters").optional(),
  content: z.string().min(5, "Content must be at least 5 characters").optional(),
  metaTitle: z.string().optional(),
  metaDescription: z.string().optional(),
  isPublished: z.boolean().optional(),
});

export type CreateCmsPageInput = z.infer<typeof CreateCmsPageSchema>;
export type UpdateCmsPageInput = z.infer<typeof UpdateCmsPageSchema>;
