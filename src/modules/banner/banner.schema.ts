import { z } from "zod";

export const createBannerSchema = z.strictObject({
    title: z.string().min(1, "Title is required"),
    thumbnailUrl: z.string().url("Thumbnail must be a valid URL"),
    linkUrl: z.string().min(1, "Link URL is required"),
    description: z.string().optional().nullable(),
    badgeText: z.string().optional().nullable(),
    displayOrder: z.number().int().optional().default(0),
    isActive: z.boolean().optional().default(true),
});

export const updateBannerSchema = createBannerSchema.partial();

export const reorderBannersSchema = z.strictObject({
    orders: z.array(
        z.strictObject({
            id: z.string(),
            displayOrder: z.number().int(),
        })
    ),
});

export const uploadBannerImageSchema = z.strictObject({
    file: z.string().min(1, "Base64 file or image URL is required"),
    fileName: z.string().optional().default("banner.jpg"),
});

export type CreateBannerInput = z.infer<typeof createBannerSchema>;
export type UpdateBannerInput = z.infer<typeof updateBannerSchema>;
export type ReorderBannersInput = z.infer<typeof reorderBannersSchema>;
export type UploadBannerImageInput = z.infer<typeof uploadBannerImageSchema>;
