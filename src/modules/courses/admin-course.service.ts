import { db } from "@/config/database";
import { cleanupOldMediaAsset } from "@/services/imagekit.service";
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
    UpdateLessonContent,
} from "./course.schema";

class AdminCourseService {
    /**
     * GET /v1/admin/courses
     * Fetches all courses with counts for modules, lessons, and enrollments.
     */
    public async listCourses(adminId: string, role: string, filters?: { search?: string; status?: string; page?: number; limit?: number }) {
        const whereClause: any = {};

        if (filters?.search) {
            whereClause.title = { contains: filters.search, mode: "insensitive" };
        }

        if (filters?.status && filters.status !== "all") {
            whereClause.isPublished = filters.status === "published";
        }

        const page = filters?.page || 1;
        const limit = filters?.limit || 10;
        const skip = (page - 1) * limit;

        const [total, courses] = await Promise.all([
            db.course.count({ where: whereClause }),
            db.course.findMany({
                where: whereClause,
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
                    thumbnailMediaId: true,
                    createdAt: true,
                    instructor: {
                        select: { id: true, name: true, email: true },
                    },
                    thumbnail: {
                        select: { id: true, url: true, storageKey: true, mimeType: true },
                    },
                    _count: {
                        select: {
                            modules: true,
                            enrollments: true,
                        },
                    },
                    modules: {
                        select: {
                            _count: {
                                select: {
                                    lessons: true
                                }
                            }
                        }
                    }
                },
                orderBy: { createdAt: "desc" },
                skip,
                take: limit,
            })
        ]);

        const formattedCourses = courses.map(course => {
            const lessonsCount = course.modules.reduce((sum, mod) => sum + mod._count.lessons, 0);
            return {
                id: course.id,
                title: course.title,
                description: course.description,
                subject: course.subject,
                language: course.language,
                goals: course.goals,
                price: course.price,
                discountPrice: course.discountPrice,
                discountValidUntil: course.discountValidUntil,
                isFree: course.isFree,
                accessDurationDays: course.accessDurationDays,
                isPublished: course.isPublished,
                thumbnailMediaId: course.thumbnailMediaId,
                thumbnail: course.thumbnail,
                createdAt: course.createdAt,
                instructor: course.instructor,
                modulesCount: course._count.modules,
                lessonsCount: lessonsCount,
                enrollmentsCount: course._count.enrollments,
            };
        });

        return {
            courses: formattedCourses,
            pagination: {
                total,
                page,
                limit,
                totalPages: Math.ceil(total / limit),
            }
        };
    }
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
                thumbnailMediaId: data.thumbnailMediaId,
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

        const existingCourse = await db.course.findUnique({
            where: { id: courseId },
            select: { thumbnailMediaId: true },
        });

        if (
            data.thumbnailMediaId !== undefined &&
            existingCourse?.thumbnailMediaId &&
            existingCourse.thumbnailMediaId !== data.thumbnailMediaId
        ) {
            await cleanupOldMediaAsset(existingCourse.thumbnailMediaId, data.thumbnailMediaId);
        }

        const updatedCourse = await db.course.update({
            where: { id: courseId },
            data: {
                ...(data.title && { title: data.title }),
                ...(data.description !== undefined && { description: data.description }),
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
                ...(data.thumbnailMediaId !== undefined && {
                    thumbnailMediaId: data.thumbnailMediaId,
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
                thumbnailMediaId: true,
                updatedAt: true,
                instructor: {
                    select: { id: true, name: true, email: true },
                },
                thumbnail: {
                    select: { id: true, url: true, storageKey: true, mimeType: true },
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

    /**
     * GET /v1/admin/courses/:courseId/modules
     * Paginated list of modules for a course.
     */
    public async getCourseModules(
        courseId: string,
        adminId: string,
        role: string,
        query?: { page?: number; limit?: number; search?: string }
    ) {
        await this.verifyCourseOwnership(courseId, adminId, role);

        const page = query?.page && query.page > 0 ? query.page : 1;
        const limit = query?.limit && query.limit > 0 ? Math.min(query.limit, 100) : 10;
        const skip = (page - 1) * limit;

        const whereClause: any = { courseId };
        if (query?.search) {
            whereClause.title = { contains: query.search, mode: "insensitive" };
        }

        const [total, modules] = await Promise.all([
            db.module.count({ where: whereClause }),
            db.module.findMany({
                where: whereClause,
                orderBy: { order: "asc" },
                skip,
                take: limit,
                select: {
                    id: true,
                    courseId: true,
                    title: true,
                    order: true,
                    _count: {
                        select: { lessons: true }
                    },
                    lessons: {
                        orderBy: { order: "asc" },
                        select: {
                            id: true,
                            title: true,
                            order: true,
                            durationSec: true,
                            unlockAfterDays: true,
                            isFreePreview: true,
                            _count: { select: { contents: true } },
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
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            })
        ]);

        return {
            modules: modules.map(mod => ({
                id: mod.id,
                courseId: mod.courseId,
                title: mod.title,
                order: mod.order,
                lessonsCount: mod._count.lessons,
                lessons: mod.lessons.map(lesson => ({
                    id: lesson.id,
                    title: lesson.title,
                    order: lesson.order,
                    durationSec: lesson.durationSec,
                    unlockAfterDays: lesson.unlockAfterDays,
                    isFreePreview: lesson.isFreePreview,
                    blocksCount: lesson._count.contents,
                    contents: lesson.contents,
                    blocks: lesson.contents,
                }))
            })),
            pagination: {
                total,
                page,
                limit,
                totalPages: Math.ceil(total / limit) || 1,
            }
        };
    }

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

        // Auto-resolve order conflicts
        let moduleOrder = data.order;
        const existingModuleWithOrder = await db.module.findFirst({
            where: { courseId, order: moduleOrder },
            select: { id: true },
        });

        if (!moduleOrder || existingModuleWithOrder) {
            const maxModule = await db.module.findFirst({
                where: { courseId },
                orderBy: { order: "desc" },
                select: { order: true },
            });
            moduleOrder = (maxModule?.order || 0) + 1;
        }

        const module = await db.module.create({
            data: {
                courseId,
                title: data.title,
                order: moduleOrder,
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

        // Auto-resolve order conflicts
        let lessonOrder = data.order;
        const existingLessonWithOrder = await db.lesson.findFirst({
            where: { moduleId, order: lessonOrder },
            select: { id: true },
        });

        if (!lessonOrder || existingLessonWithOrder) {
            const maxLesson = await db.lesson.findFirst({
                where: { moduleId },
                orderBy: { order: "desc" },
                select: { order: true },
            });
            lessonOrder = (maxLesson?.order || 0) + 1;
        }

        const lesson = await db.lesson.create({
            data: {
                moduleId,
                title: data.title,
                order: lessonOrder,
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
            select: { 
                id: true,
                contents: {
                    select: { mediaId: true }
                }
            },
        });

        if (!existingLesson) {
            throw new APIError(httpStatus.NOT_FOUND, "Lesson not found in this module");
        }

        const mediaIdsToCleanup = existingLesson.contents
            .map((c) => c.mediaId)
            .filter((id) => id !== null) as string[];

        // Delete lesson (cascades to lesson contents and progress)
        await db.lesson.delete({
            where: { id: lessonId },
        });

        // Asynchronously cleanup orphaned media assets from Cloud & DB
        mediaIdsToCleanup.forEach((mediaId) => {
            cleanupOldMediaAsset(mediaId).catch(console.error);
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
     * PUT /v1/admin/courses/:courseId/modules/:moduleId/lessons/:lessonId/contents/:contentId
     * Updates an existing content block (e.g. fix typo in title/body, change order or media).
     */
    public async updateLessonContent(
        courseId: string,
        moduleId: string,
        lessonId: string,
        contentId: string,
        adminId: string,
        role: string,
        data: UpdateLessonContent
    ) {
        await this.verifyCourseOwnership(courseId, adminId, role);

        const existingContent = await db.lessonContent.findFirst({
            where: {
                id: contentId,
                lessonId,
                lesson: { moduleId, module: { courseId } },
            },
            select: { id: true, mediaId: true },
        });

        if (!existingContent) {
            throw new APIError(
                httpStatus.NOT_FOUND,
                "Lesson content block not found in this lesson"
            );
        }

        if (
            data.mediaId !== undefined &&
            existingContent.mediaId &&
            existingContent.mediaId !== data.mediaId
        ) {
            await cleanupOldMediaAsset(existingContent.mediaId, data.mediaId);
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

        const updatedContent = await db.lessonContent.update({
            where: { id: contentId },
            data: {
                ...(data.type !== undefined && { type: data.type as any }),
                ...(data.order !== undefined && { order: data.order }),
                ...(data.title !== undefined && { title: data.title }),
                ...(data.body !== undefined && { body: data.body }),
                ...(data.mediaId !== undefined && { mediaId: data.mediaId }),
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

        return updatedContent;
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
            select: { id: true, mediaId: true },
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

        if (existingContent.mediaId) {
            cleanupOldMediaAsset(existingContent.mediaId).catch(console.error);
        }

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
                thumbnailMediaId: true,
                createdAt: true,
                updatedAt: true,
                instructor: {
                    select: { id: true, name: true, email: true },
                },
                thumbnail: {
                    select: { id: true, url: true, storageKey: true, mimeType: true },
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

    /**
     * PATCH /v1/admin/courses/:courseId/modules/reorder
     * Reorders modules in a course.
     */
    public async reorderModules(
        courseId: string,
        adminId: string,
        role: string,
        orders: { id: string; order: number }[]
    ) {
        await this.verifyCourseOwnership(courseId, adminId, role);

        await db.$transaction(async (tx) => {
            for (const item of orders) {
                await tx.module.update({
                    where: { id: item.id },
                    data: { order: item.order },
                });
            }
        });

        return { message: "Modules reordered successfully" };
    }

    /**
     * PATCH /v1/admin/courses/:courseId/modules/:moduleId/lessons/reorder
     * Reorders lessons within a module.
     */
    public async reorderLessons(
        courseId: string,
        moduleId: string,
        adminId: string,
        role: string,
        orders: { id: string; order: number }[]
    ) {
        await this.verifyCourseOwnership(courseId, adminId, role);

        await db.$transaction(async (tx) => {
            // Step 1: Set negative temp orders to avoid unique constraint conflicts
            for (let i = 0; i < orders.length; i++) {
                await tx.lesson.update({
                    where: { id: orders[i].id },
                    data: { order: -(i + 1000) },
                });
            }
            // Step 2: Set target final orders
            for (const item of orders) {
                await tx.lesson.update({
                    where: { id: item.id },
                    data: { order: item.order },
                });
            }
        });

        return { message: "Lessons reordered successfully" };
    }

    /**
     * PATCH /v1/admin/courses/:courseId/modules/:moduleId/lessons/:lessonId/contents/reorder
     * Reorders content blocks within a lesson.
     */
    public async reorderLessonContents(
        courseId: string,
        moduleId: string,
        lessonId: string,
        adminId: string,
        role: string,
        orders: { id: string; order: number }[]
    ) {
        await this.verifyCourseOwnership(courseId, adminId, role);

        await db.$transaction(async (tx) => {
            // Step 1: Set negative temp orders to avoid unique constraint conflicts
            for (let i = 0; i < orders.length; i++) {
                await tx.lessonContent.update({
                    where: { id: orders[i].id },
                    data: { order: -(i + 1000) },
                });
            }
            // Step 2: Set target final orders
            for (const item of orders) {
                await tx.lessonContent.update({
                    where: { id: item.id },
                    data: { order: item.order },
                });
            }
        });

        return { message: "Lesson contents reordered successfully" };
    }

    /**
     * PATCH /v1/admin/courses/lessons/:lessonId/blocks/reorder
     * Reorders content blocks (LessonContent) within a lesson directly by lessonId.
     */
    public async reorderLessonBlocks(
        lessonId: string,
        adminId: string,
        role: string,
        orders: { id: string; order: number }[]
    ) {
        const lesson = await db.lesson.findUnique({
            where: { id: lessonId },
            select: { id: true, module: { select: { courseId: true } } },
        });

        if (!lesson) {
            throw new APIError(httpStatus.NOT_FOUND, "Lesson not found");
        }

        await this.verifyCourseOwnership(lesson.module.courseId, adminId, role);

        await db.$transaction(async (tx) => {
            // Step 1: Set negative temp orders to avoid unique constraint conflicts
            for (let i = 0; i < orders.length; i++) {
                await tx.lessonContent.update({
                    where: { id: orders[i].id },
                    data: { order: -(i + 1000) },
                });
            }
            // Step 2: Set target final orders
            for (const item of orders) {
                await tx.lessonContent.update({
                    where: { id: item.id },
                    data: { order: item.order },
                });
            }
        });

        return { message: "Lesson blocks reordered successfully" };
    }
}

export const adminCourseService = new AdminCourseService();
