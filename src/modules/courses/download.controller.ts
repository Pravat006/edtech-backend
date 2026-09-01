import { Request, Response, NextFunction } from "express";
import httpStatus from "http-status";
import { db } from "@/config/database";
import { APIError } from "@/utils/APIError";
import { BunnyStreamMediaProvider } from "../upload/providers/bunny-stream.provider";
import { BunnyStorageMediaProvider } from "../upload/providers/bunny-storage.provider";

const bunnyStreamProvider = new BunnyStreamMediaProvider();
const bunnyStorageProvider = new BunnyStorageMediaProvider();

/**
 * GET /v1/courses/:courseId/lessons/:lessonId/download/:contentId
 * Generates an expiring signed token download URL for offline lecture caching.
 * Enforces enrollment, account status, and drip unlock rules.
 */
export const downloadLessonContentController = async (
    req: Request,
    res: Response,
    next: NextFunction
) => {
    try {
        const userId = (req as any).user?.id;
        const { courseId, lessonId, contentId } = req.params;
        const quality = (req.query.quality as string) || "720p";
        const clientIp = req.ip || req.socket.remoteAddress || undefined;

        if (!userId) {
            throw new APIError(httpStatus.UNAUTHORIZED, "User authentication required");
        }

        const now = new Date();

        // 1. Verify User exists
        const user = await db.user.findUnique({
            where: { id: userId },
            select: { id: true },
        });

        if (!user) {
            throw new APIError(httpStatus.FORBIDDEN, "User account not found");
        }

        // 2. Fetch Lesson & Module details for Drip & Schedule verification
        const lesson = await db.lesson.findFirst({
            where: { id: lessonId, module: { courseId } },
            select: {
                id: true,
                title: true,
                unlockAfterDays: true,
                isFreePreview: true,
                scheduledPublishDate: true,
                module: {
                    select: {
                        scheduledPublishDate: true,
                        course: {
                            select: { scheduledPublishDate: true, title: true }
                        }
                    }
                },
                contents: {
                    where: { id: contentId },
                    select: {
                        id: true,
                        type: true,
                        title: true,
                        body: true,
                        media: {
                            select: { id: true, url: true, storageKey: true, type: true, mimeType: true }
                        }
                    }
                }
            }
        });

        if (!lesson) {
            throw new APIError(httpStatus.NOT_FOUND, "Lesson not found in specified course");
        }

        const content = lesson.contents[0];
        if (!content) {
            throw new APIError(httpStatus.NOT_FOUND, "Requested lesson content asset not found");
        }

        // 3. Verify Scheduled Publish Date
        const lessonDate = lesson.scheduledPublishDate;
        const moduleDate = lesson.module.scheduledPublishDate;
        const courseDate = lesson.module.course.scheduledPublishDate;

        const latestSchedule = [lessonDate, moduleDate, courseDate]
            .filter((d): d is Date => d !== null && d !== undefined)
            .sort((a, b) => b.getTime() - a.getTime())[0];

        if (latestSchedule && latestSchedule > now) {
            throw new APIError(
                httpStatus.FORBIDDEN,
                `Content is scheduled for release on ${latestSchedule.toISOString()}`
            );
        }

        // 4. Enrollment Check for Non-Free Previews
        let daysEnrolled = 0;
        if (!lesson.isFreePreview) {
            const enrollment = await db.enrollment.findUnique({
                where: { userId_courseId: { userId, courseId } },
                select: { status: true, enrolledAt: true, expiresAt: true }
            });

            if (!enrollment || enrollment.status !== "ACTIVE") {
                throw new APIError(httpStatus.FORBIDDEN, "You do not have an active enrollment in this course");
            }

            if (enrollment.expiresAt && enrollment.expiresAt < now) {
                throw new APIError(httpStatus.FORBIDDEN, "Your enrollment for this course has expired");
            }

            const diffMs = now.getTime() - enrollment.enrolledAt.getTime();
            daysEnrolled = Math.floor(diffMs / (1000 * 60 * 60 * 24));

            const isUnlocked = !lesson.unlockAfterDays || daysEnrolled >= lesson.unlockAfterDays;
            if (!isUnlocked) {
                throw new APIError(httpStatus.FORBIDDEN, "This lesson is currently locked under drip settings");
            }
        }

        // 5. Asset URL & Signed Download Generation based on Type
        let downloadUrl = "";
        const ttlSeconds = 1800; // 30 minutes signed URL expiration
        const expiresAt = new Date(Date.now() + ttlSeconds * 1000).toISOString();

        if (content.type === "VIDEO") {
            const videoGuid = content.body || content.media?.storageKey || content.media?.url;
            if (!videoGuid) {
                throw new APIError(httpStatus.NOT_FOUND, "Video resource identifier missing for this lesson");
            }

            // Check Bunny Stream processing status if GUID available
            const cleanGuid = videoGuid.split("/").pop()?.split("?")[0] || videoGuid;
            const status = await bunnyStreamProvider.getVideoStatus(cleanGuid);

            if (status !== null && status !== 4 && status !== 3) {
                throw new APIError(
                    httpStatus.CONFLICT,
                    "Video is currently encoding or processing. Please try again in a few minutes."
                );
            }

            downloadUrl = bunnyStreamProvider.generateSignedDownloadUrl(cleanGuid, quality, clientIp, ttlSeconds);
        } else if (content.type === "PDF" || content.type === "TEXT") {
            const mediaUrl = content.media?.url || content.media?.storageKey || content.body;
            if (!mediaUrl) {
                throw new APIError(httpStatus.NOT_FOUND, "Document resource URL missing for this lesson");
            }

            downloadUrl = bunnyStorageProvider.generateSignedDownloadUrl(mediaUrl, ttlSeconds);
        } else {
            throw new APIError(httpStatus.BAD_REQUEST, `Unsupported content type for offline download: ${content.type}`);
        }

        res.status(httpStatus.OK).json({
            success: true,
            data: {
                contentId: content.id,
                lessonId: lesson.id,
                courseId,
                title: content.title || lesson.title,
                contentType: content.type,
                downloadUrl,
                expiresAt,
                ttlSeconds,
            }
        });
    } catch (error) {
        next(error);
    }
};
