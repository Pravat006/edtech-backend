import { z } from "zod";

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

export type InitiateUploadSchema = z.infer<typeof initiateUploadSchema>;
export type CompleteUploadPartSchema = z.infer<typeof completeUploadPartSchema>;
export type CompleteUploadSchema = z.infer<typeof completeUploadSchema>;
export type AbortUploadSchema = z.infer<typeof abortUploadSchema>;