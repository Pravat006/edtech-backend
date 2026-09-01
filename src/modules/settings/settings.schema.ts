import { z } from "zod";

export const UpsertPlatformSettingSchema = z.strictObject({
    key: z.string().min(1, "Key is required"),
    value: z.string(),
});
export type UpsertPlatformSetting = z.infer<typeof UpsertPlatformSettingSchema>;

export const UpsertPlatformSettingsBatchSchema = z.strictObject({
    settings: z.array(UpsertPlatformSettingSchema),
});
export type UpsertPlatformSettingsBatch = z.infer<typeof UpsertPlatformSettingsBatchSchema>;

export const CreateCategoryConfigSchema = z.strictObject({
    type: z.enum(["SUBJECT", "GOAL"]),
    value: z.string().min(1, "Value/Identifier is required"),
    label: z.string().min(1, "Label is required"),
    isActive: z.boolean().optional(),
});
export type CreateCategoryConfig = z.infer<typeof CreateCategoryConfigSchema>;

export const UpdateCategoryConfigSchema = z.strictObject({
    label: z.string().min(1, "Label is required").optional(),
    isActive: z.boolean().optional(),
});
export type UpdateCategoryConfig = z.infer<typeof UpdateCategoryConfigSchema>;
