import { z } from "zod";

export const CreateCmsPageSchema = z.strictObject({
  slug: z
    .string()
    .min(2, "Slug must be at least 2 characters")
    .max(100, "Slug cannot exceed 100 characters")
    .regex(/^[a-z0-9-]+$/, "Slug can only contain lowercase letters, numbers, and hyphens"),
  title: z.string().min(2, "Title must be at least 2 characters").max(255),
  content: z.string().min(5, "Content must be at least 5 characters").max(50000),
  metaTitle: z.string().max(255).optional(),
  metaDescription: z.string().max(1000).optional(),
  isPublished: z.boolean().default(true),
});

export const UpdateCmsPageSchema = z.strictObject({
  title: z.string().min(2, "Title must be at least 2 characters").max(255).optional(),
  content: z.string().min(5, "Content must be at least 5 characters").max(50000).optional(),
  metaTitle: z.string().max(255).optional(),
  metaDescription: z.string().max(1000).optional(),
  isPublished: z.boolean().optional(),
});

export type CreateCmsPageInput = z.infer<typeof CreateCmsPageSchema>;
export type UpdateCmsPageInput = z.infer<typeof UpdateCmsPageSchema>;
