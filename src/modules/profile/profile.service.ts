import { db } from "@/config/database";
import { APIError } from "@/utils/APIError";
import httpStatus from "http-status";
import { MediaType } from "@/../../generated/prisma";
import { UpdateAddress, UpdatePersonalDetails, UpdateEducationDetails } from "./profile.schema";
import { cleanupOldMediaAsset } from "@/modules/upload/upload-cleanup.service";
import { NotificationQueueService } from "@/workers/notification.queue";

async function validateMediaAsset(
    id: string,
    expectedTypes: MediaType | MediaType[],
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

    const typesArr = Array.isArray(expectedTypes) ? expectedTypes : [expectedTypes];

    if (!typesArr.includes(asset.type)) {
        throw new APIError(
            httpStatus.BAD_REQUEST,
            `${fieldLabel}: Expected ${typesArr.join(" or ")} file, but got ${asset.type}.`
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
        // Validate file types before saving - strictly PDF required for Aadhaar & PAN
        await Promise.all([
            data.aadhaarFileId && validateMediaAsset(data.aadhaarFileId, "PDF", "Aadhaar file"),
            data.panFileId && validateMediaAsset(data.panFileId, "PDF", "PAN file"),
            data.signatureImageId && validateMediaAsset(data.signatureImageId, "IMAGE", "Signature image"),
        ]);

        const currentDetails = await db.userPersonalDetails.findUnique({
            where: { userId },
            select: { aadhaarFileId: true, panFileId: true, signatureImageId: true }
        });

        if (currentDetails) {
            cleanupOldMediaAsset(currentDetails.aadhaarFileId, data.aadhaarFileId);
            cleanupOldMediaAsset(currentDetails.panFileId, data.panFileId);
            cleanupOldMediaAsset(currentDetails.signatureImageId, data.signatureImageId);
        }

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
        // Validate file types before saving — strictly PDF required for all result files
        await Promise.all([
            data.collegeResultFileId && validateMediaAsset(data.collegeResultFileId, "PDF", "College result file"),
            data.classXIIResultFileId && validateMediaAsset(data.classXIIResultFileId, "PDF", "Class XII result file"),
            data.classXResultFileId && validateMediaAsset(data.classXResultFileId, "PDF", "Class X result file"),
        ]);

        const currentEducation = await db.userEducationDetails.findUnique({
            where: { userId },
            select: { collegeResultFileId: true, classXIIResultFileId: true, classXResultFileId: true }
        });

        if (currentEducation) {
            cleanupOldMediaAsset(currentEducation.collegeResultFileId, data.collegeResultFileId);
            cleanupOldMediaAsset(currentEducation.classXIIResultFileId, data.classXIIResultFileId);
            cleanupOldMediaAsset(currentEducation.classXResultFileId, data.classXResultFileId);
        }

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

    /**
     * Admin review for student document verification (triggers Brevo email notice)
     */
    public async reviewDocumentVerification(params: {
        userId: string;
        documentType: string;
        status: "APPROVED" | "REJECTED";
        reason?: string;
    }) {
        const user = await db.user.findUnique({
            where: { id: params.userId },
            select: { id: true, name: true, email: true, phoneNumber: true },
        });

        if (!user) {
            throw new APIError(httpStatus.NOT_FOUND, "Student user not found.");
        }

        // Trigger email notice if user has an email on record
        if (user.email) {
            const emailServiceModule = await import("@/modules/email/email.service");
            emailServiceModule.emailService.sendDocumentVerificationNotice({
                to: user.email,
                studentName: user.name || "Learner",
                documentType: params.documentType,
                status: params.status,
                reason: params.reason,
            }).catch(() => {});
        }

        // Trigger Push Notification
        const title = params.status === "APPROVED" ? "Verification Approved ✅" : "Verification Rejected ❌";
        const body = params.status === "APPROVED" 
            ? `Your ${params.documentType} has been approved. You have full access!`
            : `Your ${params.documentType} was rejected. Reason: ${params.reason || "Invalid document"}`;
            
        NotificationQueueService.sendPushToUser(
            user.id,
            title,
            body,
            { documentType: params.documentType, status: params.status }
        ).catch(err => console.error("Failed to queue push notification:", err));

        return {
            success: true,
            userId: user.id,
            documentType: params.documentType,
            status: params.status,
            notifiedEmail: user.email || null,
        };
    }

    /**
     * Admin fetch pending verification documents queue
     */
    public async getPendingVerifications() {
        const personalDetails = await db.userPersonalDetails.findMany({
            where: {
                OR: [
                    { aadhaarFileId: { not: null } },
                    { panFileId: { not: null } },
                ],
            },
            include: {
                user: { select: { id: true, name: true, email: true } },
                aadhaarFile: { select: { id: true, url: true, createdAt: true } },
                panFile: { select: { id: true, url: true, createdAt: true } },
            },
        });

        const items: Array<{
            id: string;
            userId: string;
            studentName: string;
            studentEmail: string;
            documentType: string;
            submittedAt: string;
            fileUrl: string;
        }> = [];

        for (const pd of personalDetails) {
            if (pd.aadhaarFile) {
                items.push({
                    id: `aadhaar-${pd.id}`,
                    userId: pd.userId,
                    studentName: pd.user.name || "Student",
                    studentEmail: pd.user.email || "No email",
                    documentType: "Aadhaar Card",
                    submittedAt: pd.aadhaarFile.createdAt.toISOString(),
                    fileUrl: pd.aadhaarFile.url,
                });
            }
            if (pd.panFile) {
                items.push({
                    id: `pan-${pd.id}`,
                    userId: pd.userId,
                    studentName: pd.user.name || "Student",
                    studentEmail: pd.user.email || "No email",
                    documentType: "PAN Card",
                    submittedAt: pd.panFile.createdAt.toISOString(),
                    fileUrl: pd.panFile.url,
                });
            }
        }

        return items;
    }
}

export const profileService = new ProfileService();
