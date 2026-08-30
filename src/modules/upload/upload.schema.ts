import { z } from "zod";

export const createVideoSlotSchema = z.object({
    title: z.string().optional(),
    replaceMediaAssetId: z.string().uuid("Invalid MediaAsset ID format").optional()
});

export const deleteAssetSchema = z.object({
    id: z.string().min(1, "Asset ID or Storage Key is required")
});

export const initiateUploadSchema = z.object({
    filename: z.string().min(1, "Filename is required"),
    size: z.number().nonnegative("Size must be a positive number"), // or z.string() if expecting huge files as string
    mimeType: z.string().min(1, "Mime type is required"),
});

export const completeUploadPartSchema = z.object({
    ETag: z.string(),
    PartNumber: z.number().int().positive()
});

export const completeUploadSchema = z.object({
    fileId: z.string().cuid("Invalid File ID"),
    parts: z.array(completeUploadPartSchema).min(1, "At least one part is required").optional()
});

export const abortUploadSchema = z.object({
    fileId: z.string().cuid("Invalid File ID")
});

export const imageKitCompleteSchema = z.object({
    fileId: z.string().min(1, "ImageKit File ID is required"),
    url: z.string().url("Valid URL is required"),
    name: z.string().min(1, "Name is required"),
    size: z.number().nonnegative(),
    mimeType: z.string().min(1, "Mime type is required"),
    filePath: z.string().min(1, "File path is required"),
    height: z.number().optional(),
    width: z.number().optional()
});

export const bunnyStorageCompleteSchema = z.object({
    fileId: z.string().min(1, "File ID (storage key) is required"),
    url: z.string().url("Valid CDN URL is required"),
    size: z.number().nonnegative().optional(),
    mimeType: z.string().min(1, "Mime type is required"),
    storageKey: z.string().optional(),
    replaceMediaAssetId: z.string().uuid("Invalid MediaAsset ID format").optional()
});

export type InitiateUploadSchema = z.infer<typeof initiateUploadSchema>;
export type CompleteUploadPartSchema = z.infer<typeof completeUploadPartSchema>;
export type CompleteUploadSchema = z.infer<typeof completeUploadSchema>;
export type AbortUploadSchema = z.infer<typeof abortUploadSchema>;
export type ImageKitCompleteSchema = z.infer<typeof imageKitCompleteSchema>;
export type BunnyStorageCompleteSchema = z.infer<typeof bunnyStorageCompleteSchema>;