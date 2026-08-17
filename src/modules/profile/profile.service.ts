import { db } from "@/config/database";
import { APIError } from "@/utils/APIError";
import httpStatus from "http-status";
import { MediaType } from "@/../../generated/prisma";
import { UpdateAddress, UpdatePersonalDetails, UpdateEducationDetails } from "./profile.schema";

async function validateMediaAsset(
    id: string,
    expectedType: MediaType,
    fieldLabel: string
): Promise<void> {
    const asset = await db.mediaAsset.findUnique({
        where: { id },
        select: { id: true, type: true },
    });

    if (!asset) {
        throw new APIError(
            httpStatus.BAD_REQUEST,
            `${fieldLabel}: MediaAsset with ID "${id}" not found.`
        );
    }

    if (asset.type !== expectedType) {
        throw new APIError(
            httpStatus.BAD_REQUEST,
            `${fieldLabel}: Expected a ${expectedType} file, but got ${asset.type}.`
        );
    }
}

class ProfileService {

    public async getAddress(userId: string) {
        return db.userAddress.findUnique({
            where: { userId },
        });
    }

    public async upsertAddress(userId: string, data: UpdateAddress) {
        return db.userAddress.upsert({
            where: { userId },
            update: data,
            create: { userId, ...data },
        });
    }

    public async getPersonalDetails(userId: string) {
        return db.userPersonalDetails.findUnique({
            where: { userId },
            include: {
                aadhaarFile: { select: { id: true, url: true, mimeType: true } },
                panFile: { select: { id: true, url: true, mimeType: true } },
                signatureImage: { select: { id: true, url: true, mimeType: true } },
            },
        });
    }

    public async upsertPersonalDetails(userId: string, data: UpdatePersonalDetails) {
        // Validate file types before saving
        await Promise.all([
            data.aadhaarFileId && validateMediaAsset(data.aadhaarFileId, "PDF", "Aadhaar file"),
            data.panFileId && validateMediaAsset(data.panFileId, "PDF", "PAN file"),
            data.signatureImageId && validateMediaAsset(data.signatureImageId, "IMAGE", "Signature image"),
        ]);

        return db.userPersonalDetails.upsert({
            where: { userId },
            update: data,
            create: { userId, ...data },
            include: {
                aadhaarFile: { select: { id: true, url: true, mimeType: true } },
                panFile: { select: { id: true, url: true, mimeType: true } },
                signatureImage: { select: { id: true, url: true, mimeType: true } },
            },
        });
    }

    // ─── Education Details ────────────────────────────────────────────────────

    public async getEducationDetails(userId: string) {
        return db.userEducationDetails.findUnique({
            where: { userId },
            include: {
                collegeResultFile: { select: { id: true, url: true, mimeType: true } },
                classXIIResultFile: { select: { id: true, url: true, mimeType: true } },
                classXResultFile: { select: { id: true, url: true, mimeType: true } },
            },
        });
    }

    public async upsertEducationDetails(userId: string, data: UpdateEducationDetails) {
        // Validate file types before saving — all result files must be PDFs
        await Promise.all([
            data.collegeResultFileId && validateMediaAsset(data.collegeResultFileId, "PDF", "College result file"),
            data.classXIIResultFileId && validateMediaAsset(data.classXIIResultFileId, "PDF", "Class XII result file"),
            data.classXResultFileId && validateMediaAsset(data.classXResultFileId, "PDF", "Class X result file"),
        ]);

        return db.userEducationDetails.upsert({
            where: { userId },
            update: data,
            create: { userId, ...data },
            include: {
                collegeResultFile: { select: { id: true, url: true, mimeType: true } },
                classXIIResultFile: { select: { id: true, url: true, mimeType: true } },
                classXResultFile: { select: { id: true, url: true, mimeType: true } },
            },
        });
    }
}

export const profileService = new ProfileService();
