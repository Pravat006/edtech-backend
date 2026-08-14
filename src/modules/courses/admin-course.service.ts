import { db } from "@/config/database";
import httpStatus from "http-status";
import { APIError } from "@/utils/APIError";
import {
    CreateCourse,
    UpdateCourse,
    CreateModule,
    UpdateModule,
    CreateLesson,
    UpdateLesson,
    CreateLessonContent,
} from "./course.schema";

class AdminCourseService {
    /**
     * POST /v1/admin/courses
     * Creates a new course draft assigned to the logged-in instructor/admin.
     */
    public async createCourse(adminId: string, data: CreateCourse) {
        // Create course draft
        const course = await db.course.create({
            data: {
                title: data.title,
                description: data.description,
                subject: data.subject as any,
                language: data.language,
                goals: data.goals as any,
                price: data.price,
                isFree: data.isFree,
                accessDurationDays: data.accessDurationDays,
                discountPrice: data.discountPrice,
                discountValidUntil: data.discountValidUntil,
                instructorId: adminId,
                isPublished: false,
            },
            select: {
                id: true,
                title: true,
                description: true,
                subject: true,
                language: true,
                goals: true,
                price: true,
                discountPrice: true,
                discountValidUntil: true,
                isFree: true,
                accessDurationDays: true,
                isPublished: true,
                createdAt: true,
                instructor: {
                    select: { id: true, name: true, email: true },
                },
            },
        });

        return course;
    }

    /**
     * Helper to verify course ownership for SUB admins/instructors.
     */
    public async verifyCourseOwnership(courseId: string, adminId: string, role: string) {
        const course = await db.course.findUnique({
            where: { id: courseId },
            select: { id: true, instructorId: true, isPublished: true },
        });

        if (!course) {
            throw new APIError(httpStatus.NOT_FOUND, "Course not found");
        }

        if (role !== "SUPER" && course.instructorId !== adminId) {
            throw new APIError(
                httpStatus.FORBIDDEN,
                "You do not have permission to modify this course"
            );
        }

        return course;
    }

    /**
     * PUT /v1/admin/courses/:courseId
     * Updates course details. Enforces instructor ownership check.
     */
    public async updateCourse(
        courseId: string,
        adminId: string,
        role: string,
        data: UpdateCourse
    ) {
        await this.verifyCourseOwnership(courseId, adminId, role);

        const updatedCourse = await db.course.update({
            where: { id: courseId },
            data: {
                ...(data.title && { title: data.title }),
                ...(data.description && { description: data.description }),
                ...(data.subject && { subject: data.subject as any }),
                ...(data.language && { language: data.language }),
                ...(data.goals && { goals: data.goals as any }),
                ...(data.price !== undefined && { price: data.price }),
                ...(data.isFree !== undefined && { isFree: data.isFree }),
                ...(data.accessDurationDays !== undefined && {
                    accessDurationDays: data.accessDurationDays,
                }),
                ...(data.discountPrice !== undefined && {
                    discountPrice: data.discountPrice,
                }),
                ...(data.discountValidUntil !== undefined && {
                    discountValidUntil: data.discountValidUntil,
                }),
            },
            select: {
                id: true,
                title: true,
                description: true,
                subject: true,
                language: true,
                goals: true,
                price: true,
                discountPrice: true,
                discountValidUntil: true,
                isFree: true,
                accessDurationDays: true,
                isPublished: true,
                updatedAt: true,
                instructor: {
                    select: { id: true, name: true, email: true },
                },
            },
        });

        return updatedCourse;
    }

    /**
     * PATCH /v1/admin/courses/:courseId/publish
     * Toggles course published status. Validates course completeness before publishing.
     */
    public async togglePublishCourse(courseId: string, adminId: string, role: string) {
        const course = await this.verifyCourseOwnership(courseId, adminId, role);

        const newPublishStatus = !course.isPublished;

        // If publishing, check course structure completeness
        if (newPublishStatus) {
            const courseWithStructure = await db.course.findUnique({
                where: { id: courseId },
                select: {
                    modules: {
                        select: {
                            id: true,
                            _count: { select: { lessons: true } },
                        },
                    },
                },
            });

            if (!courseWithStructure || courseWithStructure.modules.length === 0) {
                throw new APIError(
                    httpStatus.BAD_REQUEST,
                    "Cannot publish a course without at least one module"
                );
            }

            const hasEmptyModule = courseWithStructure.modules.some(
                (m) => m._count.lessons === 0
            );

            if (hasEmptyModule) {
                throw new APIError(
                    httpStatus.BAD_REQUEST,
                    "Cannot publish a course with empty modules. Every module must contain at least one lesson."
                );
            }
        }

        const updatedCourse = await db.course.update({
            where: { id: courseId },
            data: { isPublished: newPublishStatus },
            select: {
                id: true,
                title: true,
                isPublished: true,
                updatedAt: true,
            },
        });

        return {
            course: updatedCourse,
            isPublished: updatedCourse.isPublished,
            message: updatedCourse.isPublished
                ? "Course published successfully"
                : "Course unpublished and reverted to draft",
        };
    }

    // ─── Module Management ────────────────────────────────────────────────────────

    /**
     * POST /v1/admin/courses/:courseId/modules
     * Add a module to a course.
     */
    public async createModule(
        courseId: string,
        adminId: string,
        role: string,
        data: CreateModule
    ) {
        await this.verifyCourseOwnership(courseId, adminId, role);

        const module = await db.module.create({
            data: {
                courseId,
                title: data.title,
                order: data.order,
            },
            select: {
                id: true,
                courseId: true,
                title: true,
                order: true,
            },
        });

        return module;
    }

    /**
     * PUT /v1/admin/courses/:courseId/modules/:moduleId
     * Update module details or order.
     */
    public async updateModule(
        courseId: string,
        moduleId: string,
        adminId: string,
        role: string,
        data: UpdateModule
    ) {
        await this.verifyCourseOwnership(courseId, adminId, role);

        const existingModule = await db.module.findFirst({
            where: { id: moduleId, courseId },
            select: { id: true },
        });

        if (!existingModule) {
            throw new APIError(httpStatus.NOT_FOUND, "Module not found in this course");
        }

        const updatedModule = await db.module.update({
            where: { id: moduleId },
            data: {
                ...(data.title && { title: data.title }),
                ...(data.order !== undefined && { order: data.order }),
            },
            select: {
                id: true,
                courseId: true,
                title: true,
                order: true,
            },
        });

        return updatedModule;
    }

    /**
     * DELETE /v1/admin/courses/:courseId/modules/:moduleId
     * Deletes a module and re-normalizes module order gaps.
     */
    public async deleteModule(
        courseId: string,
        moduleId: string,
        adminId: string,
        role: string
    ) {
        await this.verifyCourseOwnership(courseId, adminId, role);

        const existingModule = await db.module.findFirst({
            where: { id: moduleId, courseId },
            select: { id: true },
        });

        if (!existingModule) {
            throw new APIError(httpStatus.NOT_FOUND, "Module not found in this course");
        }

        // Delete module (cascade deletes lessons and lesson contents)
        await db.module.delete({
            where: { id: moduleId },
        });

        // Re-normalize order of remaining modules sequentially
        const remainingModules = await db.module.findMany({
            where: { courseId },
            orderBy: { order: "asc" },
            select: { id: true, order: true },
        });

        for (let i = 0; i < remainingModules.length; i++) {
            const expectedOrder = i + 1;
            if (remainingModules[i].order !== expectedOrder) {
                await db.module.update({
                    where: { id: remainingModules[i].id },
                    data: { order: expectedOrder },
                });
            }
        }

        return { message: "Module deleted successfully and order normalized" };
    }

    // ─── Lesson Management ────────────────────────────────────────────────────────

    /**
     * POST /v1/admin/courses/:courseId/modules/:moduleId/lessons
     * Add a lesson to a module.
     */
    public async createLesson(
        courseId: string,
        moduleId: string,
        adminId: string,
        role: string,
        data: CreateLesson
    ) {
        await this.verifyCourseOwnership(courseId, adminId, role);

        const module = await db.module.findFirst({
            where: { id: moduleId, courseId },
            select: { id: true },
        });

        if (!module) {
            throw new APIError(httpStatus.NOT_FOUND, "Module not found in this course");
        }

        const lesson = await db.lesson.create({
            data: {
                moduleId,
                title: data.title,
                order: data.order,
                durationSec: data.durationSec,
                unlockAfterDays: data.unlockAfterDays,
                isFreePreview: data.isFreePreview,
            },
            select: {
                id: true,
                moduleId: true,
                title: true,
                order: true,
                durationSec: true,
                unlockAfterDays: true,
                isFreePreview: true,
            },
        });

        return lesson;
    }

    /**
     * PUT /v1/admin/courses/:courseId/modules/:moduleId/lessons/:lessonId
     * Update lesson details, drip unlock days, or preview flag.
     */
    public async updateLesson(
        courseId: string,
        moduleId: string,
        lessonId: string,
        adminId: string,
        role: string,
        data: UpdateLesson
    ) {
        await this.verifyCourseOwnership(courseId, adminId, role);

        const existingLesson = await db.lesson.findFirst({
            where: {
                id: lessonId,
                moduleId,
                module: { courseId },
            },
            select: { id: true },
        });

        if (!existingLesson) {
            throw new APIError(httpStatus.NOT_FOUND, "Lesson not found in this module");
        }

        const updatedLesson = await db.lesson.update({
            where: { id: lessonId },
            data: {
                ...(data.title && { title: data.title }),
                ...(data.order !== undefined && { order: data.order }),
                ...(data.durationSec !== undefined && { durationSec: data.durationSec }),
                ...(data.unlockAfterDays !== undefined && {
                    unlockAfterDays: data.unlockAfterDays,
                }),
                ...(data.isFreePreview !== undefined && {
                    isFreePreview: data.isFreePreview,
                }),
            },
            select: {
                id: true,
                moduleId: true,
                title: true,
                order: true,
                durationSec: true,
                unlockAfterDays: true,
                isFreePreview: true,
            },
        });

        return updatedLesson;
    }

    /**
     * DELETE /v1/admin/courses/:courseId/modules/:moduleId/lessons/:lessonId
     * Deletes a lesson and re-normalizes lesson order gaps.
     */
    public async deleteLesson(
        courseId: string,
        moduleId: string,
        lessonId: string,
        adminId: string,
        role: string
    ) {
        await this.verifyCourseOwnership(courseId, adminId, role);

        const existingLesson = await db.lesson.findFirst({
            where: {
                id: lessonId,
                moduleId,
                module: { courseId },
            },
            select: { id: true },
        });

        if (!existingLesson) {
            throw new APIError(httpStatus.NOT_FOUND, "Lesson not found in this module");
        }

        // Delete lesson (cascades to lesson contents and progress)
        await db.lesson.delete({
            where: { id: lessonId },
        });

        // Re-normalize lesson order sequentially
        const remainingLessons = await db.lesson.findMany({
            where: { moduleId },
            orderBy: { order: "asc" },
            select: { id: true, order: true },
        });

        for (let i = 0; i < remainingLessons.length; i++) {
            const expectedOrder = i + 1;
            if (remainingLessons[i].order !== expectedOrder) {
                await db.lesson.update({
                    where: { id: remainingLessons[i].id },
                    data: { order: expectedOrder },
                });
            }
        }

        return { message: "Lesson deleted successfully and order normalized" };
    }

    // ─── Lesson Content Management ────────────────────────────────────────────────

    /**
     * POST /v1/admin/courses/:courseId/modules/:moduleId/lessons/:lessonId/contents
     * Adds a content block (VIDEO, PDF, TEXT) to a lesson.
     */
    public async addLessonContent(
        courseId: string,
        moduleId: string,
        lessonId: string,
        adminId: string,
        role: string,
        data: CreateLessonContent
    ) {
        await this.verifyCourseOwnership(courseId, adminId, role);

        const lesson = await db.lesson.findFirst({
            where: {
                id: lessonId,
                moduleId,
                module: { courseId },
            },
            select: { id: true },
        });

        if (!lesson) {
            throw new APIError(httpStatus.NOT_FOUND, "Lesson not found in this module");
        }

        if (data.mediaId) {
            const media = await db.mediaAsset.findUnique({
                where: { id: data.mediaId },
                select: { id: true },
            });
            if (!media) {
                throw new APIError(httpStatus.BAD_REQUEST, "Specified media asset not found");
            }
        }

        const content = await db.lessonContent.create({
            data: {
                lessonId,
                type: data.type as any,
                order: data.order,
                title: data.title,
                body: data.body,
                mediaId: data.mediaId,
            },
            select: {
                id: true,
                lessonId: true,
                type: true,
                order: true,
                title: true,
                body: true,
                mediaId: true,
                media: {
                    select: {
                        id: true,
                        storageKey: true,
                        url: true,
                        mimeType: true,
                    },
                },
                createdAt: true,
            },
        });

        return content;
    }

    /**
     * DELETE /v1/admin/courses/:courseId/modules/:moduleId/lessons/:lessonId/contents/:contentId
     * Deletes a content block from a lesson and re-normalizes content order.
     */
    public async deleteLessonContent(
        courseId: string,
        moduleId: string,
        lessonId: string,
        contentId: string,
        adminId: string,
        role: string
    ) {
        await this.verifyCourseOwnership(courseId, adminId, role);

        const existingContent = await db.lessonContent.findFirst({
            where: {
                id: contentId,
                lessonId,
                lesson: { moduleId, module: { courseId } },
            },
            select: { id: true },
        });

        if (!existingContent) {
            throw new APIError(
                httpStatus.NOT_FOUND,
                "Lesson content block not found in this lesson"
            );
        }

        await db.lessonContent.delete({
            where: { id: contentId },
        });

        // Re-normalize content block order sequentially
        const remainingContents = await db.lessonContent.findMany({
            where: { lessonId },
            orderBy: { order: "asc" },
            select: { id: true, order: true },
        });

        for (let i = 0; i < remainingContents.length; i++) {
            const expectedOrder = i + 1;
            if (remainingContents[i].order !== expectedOrder) {
                await db.lessonContent.update({
                    where: { id: remainingContents[i].id },
                    data: { order: expectedOrder },
                });
            }
        }

        return { message: "Lesson content block deleted successfully and order normalized" };
    }

    // ─── Course Analytics ──────────────────────────────────────────────────────────

    /**
     * GET /v1/admin/courses/:courseId/analytics
     * Returns comprehensive course performance analytics (enrollments, revenue, completion rate, ratings).
     */
    public async getCourseAnalytics(courseId: string, adminId: string, role: string) {
        const course = await db.course.findUnique({
            where: { id: courseId },
            select: {
                id: true,
                title: true,
                isPublished: true,
                instructorId: true,
                price: true,
            },
        });

        if (!course) {
            throw new APIError(httpStatus.NOT_FOUND, "Course not found");
        }

        if (role !== "SUPER" && course.instructorId !== adminId) {
            throw new APIError(
                httpStatus.FORBIDDEN,
                "You do not have permission to view analytics for this course"
            );
        }

        const now = new Date();

        // 1. Enrollment stats
        const totalEnrollments = await db.enrollment.count({
            where: { courseId },
        });

        const activeEnrollments = await db.enrollment.count({
            where: { courseId, status: "ACTIVE" },
        });

        const completedEnrollments = await db.enrollment.count({
            where: { courseId, completedAt: { not: null } },
        });

        const expiredEnrollments = await db.enrollment.count({
            where: { courseId, expiresAt: { lt: now } },
        });

        const completionRate =
            totalEnrollments > 0
                ? Math.round((completedEnrollments / totalEnrollments) * 1000) / 10
                : 0;

        // 2. Revenue stats (Sum of successful payments)
        const revenueAggregate = await db.payment.aggregate({
            where: {
                status: "SUCCESS",
                enrollment: { courseId },
            },
            _sum: { amount: true },
        });

        const totalRevenue = revenueAggregate._sum?.amount
            ? Number(revenueAggregate._sum.amount)
            : 0;

        // 3. Content stats
        const totalModules = await db.module.count({
            where: { courseId },
        });

        const totalLessons = await db.lesson.count({
            where: { module: { courseId } },
        });

        // 4. Rating stats
        const ratingAggregate = await db.review.aggregate({
            where: { courseId },
            _avg: { rating: true },
            _count: { rating: true },
        });

        const totalReviews = ratingAggregate._count.rating;
        const averageRating = ratingAggregate._avg.rating
            ? Math.round(ratingAggregate._avg.rating * 10) / 10
            : null;

        return {
            courseId: course.id,
            title: course.title,
            isPublished: course.isPublished,
            metrics: {
                totalEnrollments,
                activeEnrollments,
                completedEnrollments,
                expiredEnrollments,
                completionRate,
                totalRevenue,
                totalModules,
                totalLessons,
                totalReviews,
                averageRating,
            },
        };
    }

    /**
     * GET /v1/admin/courses/:courseId/preview
     * Full student player preview mode for instructors/admins.
     * Bypasses enrollment guards and drip lock restrictions.
     */
    public async getCoursePreview(courseId: string, adminId: string, role: string) {
        await this.verifyCourseOwnership(courseId, adminId, role);

        const course = await db.course.findUnique({
            where: { id: courseId },
            select: {
                id: true,
                title: true,
                description: true,
                subject: true,
                language: true,
                goals: true,
                price: true,
                discountPrice: true,
                isFree: true,
                accessDurationDays: true,
                isPublished: true,
                createdAt: true,
                updatedAt: true,
                instructor: {
                    select: { id: true, name: true, email: true },
                },
                modules: {
                    orderBy: { order: "asc" },
                    select: {
                        id: true,
                        title: true,
                        order: true,
                        lessons: {
                            orderBy: { order: "asc" },
                            select: {
                                id: true,
                                title: true,
                                order: true,
                                durationSec: true,
                                unlockAfterDays: true,
                                isFreePreview: true,
                                contents: {
                                    orderBy: { order: "asc" },
                                    select: {
                                        id: true,
                                        type: true,
                                        order: true,
                                        title: true,
                                        body: true,
                                        mediaId: true,
                                        media: {
                                            select: {
                                                id: true,
                                                storageKey: true,
                                                url: true,
                                                mimeType: true,
                                            },
                                        },
                                    },
                                },
                            },
                        },
                    },
                },
            },
        });

        if (!course) {
            throw new APIError(httpStatus.NOT_FOUND, "Course not found");
        }

        return course;
    }
}

export const adminCourseService = new AdminCourseService();
