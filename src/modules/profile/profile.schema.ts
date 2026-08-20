import { z } from "zod";

// ─── Address ─────────────────────────────────────────────────────────────────

export const UpdateAddressSchema = z.object({
    permanentAddress: z.string().trim().optional(),
    permanentAddressPincode: z
        .string()
        .trim()
        .regex(/^\d{6}$/, "Pincode must be exactly 6 digits")
        .optional(),
    correspondenceAddress: z.string().trim().optional(),
    correspondenceAddressPincode: z
        .string()
        .trim()
        .regex(/^\d{6}$/, "Pincode must be exactly 6 digits")
        .optional(),
});

export type UpdateAddress = z.infer<typeof UpdateAddressSchema>;

// ─── Personal Details ─────────────────────────────────────────────────────────

export const UpdatePersonalDetailsSchema = z.object({
    dateOfBirth: z.coerce.date().optional(),
    gender: z
        .enum(["MALE", "FEMALE", "OTHER", "PREFER_NOT_TO_SAY"])
        .optional(),
    bloodGroup: z
        .enum(["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"])
        .optional(),
    aadhaarNumber: z
        .string()
        .trim()
        .regex(/^\d{12}$/, "Aadhaar number must be exactly 12 digits")
        .optional(),
    aadhaarFileId: z.string().uuid("Invalid media asset ID").nullable().optional(),
    panNumber: z
        .string()
        .trim()
        .toUpperCase()
        .regex(/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/, "Invalid PAN number format")
        .optional(),
    panFileId: z.string().uuid("Invalid media asset ID").nullable().optional(),
    signatureImageId: z.string().uuid("Invalid media asset ID").nullable().optional(),
});

export type UpdatePersonalDetails = z.infer<typeof UpdatePersonalDetailsSchema>;

const percentageField = z.coerce
    .number()
    .min(0, "Marks cannot be negative")
    .max(100, "Marks cannot exceed 100")
    .optional();

export const UpdateEducationDetailsSchema = z.object({
    collegeName: z.string().trim().optional(),
    collegeMarks: percentageField,
    collegeResultFileId: z.string().uuid("Invalid media asset ID").nullable().optional(),

    schoolName: z.string().trim().optional(),
    marksClassXII: percentageField,
    classXIIResultFileId: z.string().uuid("Invalid media asset ID").nullable().optional(),

    marksClassX: percentageField,
    classXResultFileId: z.string().uuid("Invalid media asset ID").nullable().optional(),
});

export type UpdateEducationDetails = z.infer<typeof UpdateEducationDetailsSchema>;

export const ReviewDocumentVerificationSchema = z.object({
    userId: z.string().uuid("Invalid user ID"),
    documentType: z.string().min(1, "Document type is required"),
    status: z.enum(["APPROVED", "REJECTED"]),
    reason: z.string().trim().optional(),
});

export type ReviewDocumentVerification = z.infer<typeof ReviewDocumentVerificationSchema>;

