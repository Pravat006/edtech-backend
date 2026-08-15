import { db } from "@/config/database";
import httpStatus from "http-status";
import { APIError } from "@/utils/APIError";
import { CourseListQuery, UpdateProgress, SubmitReview } from "./course.schema";

const COURSE_SELECT = {
    id: true,
    title: true,
    subject: true,
    language: true,
    price: true,
    discountPrice: true,
    discountValidUntil: true,
    isFree: true,
    accessDurationDays: true,
    createdAt: true,
    instructor: { select: { id: true, name: true } },
    thumbnail: { select: { url: true } },
    _count: { select: { enrollments: true } },
    reviews: { select: { rating: true } },
} as const;

type RawCourse = Awaited<ReturnType<typeof db.course.findMany<{ select: typeof COURSE_SELECT }>>>[number];

function shapeCourse(course: RawCourse) {
    const avgRating =
        course.reviews.length > 0
            ? Math.round(
                (course.reviews.reduce((sum, r) => sum + r.rating, 0) /
                    course.reviews.length) *
                10
            ) / 10
            : null;

    return {
        id: course.id,
        title: course.title,
        subject: course.subject,
        language: course.language,
        price: course.price,
        discountPrice: course.discountPrice,
        discountValidUntil: course.discountValidUntil,
        isFree: course.isFree,
        accessDurationDays: course.accessDurationDays,
        thumbnailUrl: course.thumbnail?.url ?? null,
        instructor: course.instructor ?? null,
        enrollmentCount: course._count.enrollments,
        avgRating,
        createdAt: course.createdAt,
    };
}

class CourseService {
    /**
     * GET /v1/courses
     * Paginated published course feed with optional filters.
     * Excludes courses the user is already enrolled in.
     */
    public async getCourses(userId: string, query: CourseListQuery) {
        const { subject, language, isFree, search, cursor, limit } = query;

        const courses = await db.course.findMany({
            where: {
                isPublished: true,
                enrollments: { none: { userId } },
                ...(subject && { subject: subject as any }),
                ...(language && { language }),
                ...(isFree !== undefined && { isFree }),
                ...(search && {
                    title: { contains: search, mode: "insensitive" as const },
                }),
            },
            ...(cursor && { cursor: { id: cursor }, skip: 1 }),
            take: limit,
            orderBy: { createdAt: "desc" },
            select: COURSE_SELECT,
        });

        const nextCursor =
            courses.length === limit ? courses[courses.length - 1].id : null;

        return { courses: courses.map(shapeCourse), nextCursor };
    }

    /**
     * GET /v1/courses/for-you
     * Returns a personalised feed based on the user's subject preferences.
     * Preference-matched courses come first; popular courses fill any remaining slots.
     * Edge case: user with no preferences gets the top popular courses.
     */
    public async getPersonalisedCourses(userId: string, limit: number = 20) {
        // 1. Fetch enrolled course ids + user preferences in one query
        const user = await db.user.findUnique({
            where: { id: userId },
            select: {
                preferences: { select: { subjects: true } },
                enrollments: { select: { courseId: true } },
            },
        });

        const enrolledIds = user?.enrollments.map((e) => e.courseId) ?? [];
        const preferredSubjects = user?.preferences?.subjects ?? [];

        const baseWhere = {
            isPublished: true,
            id: { notIn: enrolledIds.length > 0 ? enrolledIds : ["__none__"] },
        };

        // 2. Preference-matched courses (sorted by popularity)
        let personalised: RawCourse[] = [];

        if (preferredSubjects.length > 0) {
            personalised = await db.course.findMany({
                where: {
                    ...baseWhere,
                    subject: { in: preferredSubjects as any[] },
                },
                take: limit,
                orderBy: { enrollments: { _count: "desc" } },
                select: COURSE_SELECT,
            });
        }

        // 3. Fill remaining slots with most-popular courses not already in the personalised list
        const remaining = limit - personalised.length;
        let popular: RawCourse[] = [];

        if (remaining > 0) {
            const excludeIds = [
                ...enrolledIds,
                ...personalised.map((c) => c.id),
            ];

            popular = await db.course.findMany({
                where: {
                    isPublished: true,
                    id: { notIn: excludeIds.length > 0 ? excludeIds : ["__none__"] },
                },
                take: remaining,
                orderBy: { enrollments: { _count: "desc" } },
                select: COURSE_SELECT,
            });
        }

        return {
            personalised: personalised.map(shapeCourse),
            popular: popular.map(shapeCourse),
        };
    }

    /**
     * GET /v1/courses/:courseId
     * Returns course details including syllabus preview (module/lesson titles only).
     * Calculates user enrollment status and progress percentage if enrolled.
     */
    public async getCourseDetail(courseId: string, userId: string) {
        const course = await db.course.findFirst({
            where: { id: courseId, isPublished: true },
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
                createdAt: true,
                instructor: {
                    select: { id: true, name: true, email: true },
                },
                thumbnail: {
                    select: { url: true },
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
                            },
                        },
                    },
                },
                enrollments: {
                    where: { userId, status: "ACTIVE" },
                    select: { id: true, enrolledAt: true },
                },
                _count: {
                    select: { enrollments: true, reviews: true },
                },
            },
        });

        if (!course) {
            throw new APIError(httpStatus.NOT_FOUND, "Course not found");
        }

        // Aggregate review rating
        const ratingAggregate = await db.review.aggregate({
            where: { courseId },
            _avg: { rating: true },
        });
        const avgRating = ratingAggregate._avg.rating
            ? Math.round(ratingAggregate._avg.rating * 10) / 10
            : null;

        // Fetch top 3 recent reviews
        const recentReviews = await db.review.findMany({
            where: { courseId },
            orderBy: { createdAt: "desc" },
            take: 3,
            select: {
                id: true,
                rating: true,
                comment: true,
                createdAt: true,
                user: {
                    select: { id: true, name: true },
                },
            },
        });

        const isEnrolled = course.enrollments.length > 0;
        let progressPercent: number | null = null;

        const totalLessons = course.modules.reduce(
            (acc, m) => acc + m.lessons.length,
            0
        );

        if (isEnrolled && totalLessons > 0) {
            const completedLessons = await db.lessonProgress.count({
                where: {
                    userId,
                    status: "COMPLETED",
                    lesson: { module: { courseId } },
                },
            });
            progressPercent = Math.round((completedLessons / totalLessons) * 100);
        } else if (isEnrolled) {
            progressPercent = 0;
        }

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
            thumbnailUrl: course.thumbnail?.url ?? null,
            instructor: course.instructor ?? null,
            enrollmentCount: course._count.enrollments,
            reviewsCount: course._count.reviews,
            avgRating,
            recentReviews: recentReviews.map((r) => ({
                id: r.id,
                rating: r.rating,
                comment: r.comment,
                createdAt: r.createdAt,
                user: r.user,
            })),
            modules: course.modules,
            isEnrolled,
            progressPercent,
            createdAt: course.createdAt,
        };
    }

    /**
     * GET /v1/courses/my-courses
     * Returns all active, non-expired courses the user is enrolled in with progress details.
     */
    public async getMyCourses(userId: string) {
        const now = new Date();

        const enrollments = await db.enrollment.findMany({
            where: {
                userId,
                status: "ACTIVE",
                OR: [
                    { expiresAt: null },
                    { expiresAt: { gt: now } },
                ],
            },
            orderBy: { enrolledAt: "desc" },
            select: {
                id: true,
                enrolledAt: true,
                expiresAt: true,
                completedAt: true,
                course: {
                    select: {
                        id: true,
                        title: true,
                        subject: true,
                        language: true,
                        thumbnail: {
                            select: { url: true },
                        },
                        instructor: {
                            select: { id: true, name: true },
                        },
                        modules: {
                            select: {
                                lessons: {
                                    select: { id: true },
                                },
                            },
                        },
                    },
                },
            },
        });

        // Compute progress per enrolled course concurrently
        const enrolledCourses = await Promise.all(
            enrollments.map(async (e) => {
                const totalLessons = e.course.modules.reduce(
                    (acc, m) => acc + m.lessons.length,
                    0
                );

                let completedLessons = 0;
                let lastStudiedAt: Date | null = null;

                if (totalLessons > 0) {
                    completedLessons = await db.lessonProgress.count({
                        where: {
                            userId,
                            status: "COMPLETED",
                            lesson: { module: { courseId: e.course.id } },
                        },
                    });

                    const lastProgress = await db.lessonProgress.findFirst({
                        where: {
                            userId,
                            lesson: { module: { courseId: e.course.id } },
                        },
                        orderBy: { updatedAt: "desc" },
                        select: { updatedAt: true },
                    });

                    if (lastProgress) {
                        lastStudiedAt = lastProgress.updatedAt;
                    }
                }

                const progressPercent =
                    totalLessons > 0
                        ? Math.round((completedLessons / totalLessons) * 100)
                        : 0;

                return {
                    enrollmentId: e.id,
                    enrolledAt: e.enrolledAt,
                    expiresAt: e.expiresAt,
                    completedAt: e.completedAt,
                    lastStudiedAt,
                    progressPercent,
                    completedLessons,
                    totalLessons,
                    course: {
                        id: e.course.id,
                        title: e.course.title,
                        subject: e.course.subject,
                        language: e.course.language,
                        thumbnailUrl: e.course.thumbnail?.url ?? null,
                        instructor: e.course.instructor ?? null,
                    },
                };
            })
        );

        return enrolledCourses;
    }

    /**
     * GET /v1/courses/:courseId/learn
     * Returns full course structure with video/PDF content for enrolled users.
     * Enforces drip content unlock logic and attaches lesson progress.
     */
    public async getLearnData(courseId: string, userId: string) {
        const now = new Date();

        // 1. Verify enrollment and check expiration
        const enrollment = await db.enrollment.findUnique({
            where: {
                userId_courseId: { userId, courseId },
            },
            select: {
                id: true,
                status: true,
                enrolledAt: true,
                expiresAt: true,
            },
        });

        if (!enrollment || enrollment.status !== "ACTIVE") {
            throw new APIError(httpStatus.FORBIDDEN, "You are not enrolled in this course");
        }

        if (enrollment.expiresAt && enrollment.expiresAt < now) {
            throw new APIError(httpStatus.FORBIDDEN, "Your access to this course has expired");
        }

        const diffMs = now.getTime() - enrollment.enrolledAt.getTime();
        const daysEnrolled = Math.floor(diffMs / (1000 * 60 * 60 * 24));

        // 2. Fetch course modules, lessons, and content
        const course = await db.course.findUnique({
            where: { id: courseId },
            select: {
                id: true,
                title: true,
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
                                quiz: {
                                    select: { id: true, title: true },
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

        // 3. Fetch user lesson progress map
        const progressList = await db.lessonProgress.findMany({
            where: {
                userId,
                lesson: { module: { courseId } },
            },
            select: {
                lessonId: true,
                status: true,
                watchTimeSec: true,
                lastPositionSec: true,
                completedAt: true,
            },
        });

        const progressMap = new Map(
            progressList.map((p) => [p.lessonId, p])
        );

        // 4. Process modules and lessons with drip logic & progress
        const modules = course.modules.map((module) => {
            const lessons = module.lessons.map((lesson) => {
                const isUnlocked =
                    lesson.isFreePreview ||
                    lesson.unlockAfterDays === null ||
                    lesson.unlockAfterDays === undefined ||
                    daysEnrolled >= lesson.unlockAfterDays;

                const userProgress = progressMap.get(lesson.id) ?? {
                    status: "NOT_STARTED",
                    watchTimeSec: 0,
                    lastPositionSec: 0,
                    completedAt: null,
                };

                return {
                    id: lesson.id,
                    title: lesson.title,
                    order: lesson.order,
                    durationSec: lesson.durationSec,
                    unlockAfterDays: lesson.unlockAfterDays,
                    isFreePreview: lesson.isFreePreview,
                    isUnlocked,
                    userProgress: {
                        status: userProgress.status,
                        watchTimeSec: userProgress.watchTimeSec,
                        lastPositionSec: userProgress.lastPositionSec,
                        completedAt: userProgress.completedAt,
                    },
                    quiz: isUnlocked ? lesson.quiz : null,
                };
            });

            return {
                id: module.id,
                title: module.title,
                order: module.order,
                lessons,
            };
        });

        return {
            courseId: course.id,
            courseTitle: course.title,
            enrollmentId: enrollment.id,
            enrolledAt: enrollment.enrolledAt,
            expiresAt: enrollment.expiresAt,
            daysEnrolled,
            modules,
        };
    }

    /**
     * GET /v1/courses/:courseId/lessons/:lessonId/content
     * Lazy-loads heavy content (videos, PDFs, text) for a single lesson.
     */
    public async getLessonContent(courseId: string, lessonId: string, userId: string) {
        const now = new Date();

        // 1. Verify enrollment
        const enrollment = await db.enrollment.findUnique({
            where: { userId_courseId: { userId, courseId } },
            select: { status: true, enrolledAt: true, expiresAt: true },
        });

        if (!enrollment || enrollment.status !== "ACTIVE") {
            throw new APIError(httpStatus.FORBIDDEN, "You are not enrolled in this course");
        }
        if (enrollment.expiresAt && enrollment.expiresAt < now) {
            throw new APIError(httpStatus.FORBIDDEN, "Your access to this course has expired");
        }

        // 2. Get lesson details to check drip status
        const lesson = await db.lesson.findFirst({
            where: { id: lessonId, module: { courseId } },
            select: { 
                id: true, 
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
                        media: {
                            select: { id: true, url: true, type: true, mimeType: true },
                        },
                    },
                }
            },
        });

        if (!lesson) {
            throw new APIError(httpStatus.NOT_FOUND, "Lesson not found in this course");
        }

        // 3. Check Drip Status
        const diffMs = now.getTime() - enrollment.enrolledAt.getTime();
        const daysEnrolled = Math.floor(diffMs / (1000 * 60 * 60 * 24));
        const isUnlocked = lesson.isFreePreview || !lesson.unlockAfterDays || daysEnrolled >= lesson.unlockAfterDays;

        if (!isUnlocked) {
            throw new APIError(httpStatus.FORBIDDEN, "This lesson is currently locked (Drip content)");
        }

        return lesson.contents;
    }

    /**
     * PATCH /v1/courses/:courseId/lessons/:lessonId/progress
     * Save watch position and status for a lesson.
     * Auto-issues a certificate if all course lessons are completed.
     */
    public async updateLessonProgress(
        userId: string,
        courseId: string,
        lessonId: string,
        data: UpdateProgress
    ) {
        const now = new Date();

        return await db.$transaction(async (tx) => {
            // 1. Verify lesson exists and belongs to the given course
            const lesson = await tx.lesson.findFirst({
                where: {
                    id: lessonId,
                    module: { courseId },
                },
                select: {
                    id: true,
                    isFreePreview: true,
                },
            });

            if (!lesson) {
                throw new APIError(httpStatus.NOT_FOUND, "Lesson not found in this course");
            }

            // 2. Check enrollment and expiration
            const enrollment = await tx.enrollment.findUnique({
                where: {
                    userId_courseId: { userId, courseId },
                },
                select: {
                    id: true,
                    status: true,
                    expiresAt: true,
                },
            });

            // Non-enrolled users watching free previews: do not save progress
            if (!enrollment || enrollment.status !== "ACTIVE") {
                if (lesson.isFreePreview) {
                    return {
                        progress: null,
                        certificateIssued: false,
                        message: "Progress tracking ignored for non-enrolled free preview user",
                    };
                }
                throw new APIError(httpStatus.FORBIDDEN, "You are not enrolled in this course");
            }

            if (enrollment.expiresAt && enrollment.expiresAt < now) {
                throw new APIError(httpStatus.FORBIDDEN, "Your access to this course has expired");
            }

            // 3. Upsert lesson progress
            const existingProgress = await tx.lessonProgress.findUnique({
                where: {
                    userId_lessonId: { userId, lessonId },
                },
                select: { completedAt: true },
            });

            const completedAt =
                data.status === "COMPLETED"
                    ? (existingProgress?.completedAt ?? now)
                    : null;

            const progress = await tx.lessonProgress.upsert({
                where: {
                    userId_lessonId: { userId, lessonId },
                },
                update: {
                    watchTimeSec: data.watchTimeSec,
                    lastPositionSec: data.lastPositionSec,
                    status: data.status,
                    completedAt,
                },
                create: {
                    userId,
                    lessonId,
                    watchTimeSec: data.watchTimeSec,
                    lastPositionSec: data.lastPositionSec,
                    status: data.status,
                    completedAt,
                },
            });

            // 4. Auto-issue Certificate check if status is COMPLETED
            let certificateIssued = false;

            if (data.status === "COMPLETED") {
                const totalLessons = await tx.lesson.count({
                    where: { module: { courseId } },
                });

                const completedLessons = await tx.lessonProgress.count({
                    where: {
                        userId,
                        status: "COMPLETED",
                        lesson: { module: { courseId } },
                    },
                });

                if (totalLessons > 0 && completedLessons >= totalLessons) {
                    // Idempotent certificate check
                    const existingCert = await tx.certificate.findUnique({
                        where: { enrollmentId: enrollment.id },
                    });

                    if (!existingCert) {
                        await tx.certificate.create({
                            data: {
                                userId,
                                enrollmentId: enrollment.id,
                            },
                        });

                        await tx.enrollment.update({
                            where: { id: enrollment.id },
                            data: { completedAt: now },
                        });

                        certificateIssued = true;
                    }
                }
            }

            return {
                progress,
                certificateIssued,
            };
        });
    }

    /**
     * POST /v1/courses/:courseId/reviews
     * Allows an enrolled user to leave a review for a course.
     * Enforces completion of at least 1 lesson before posting.
     */
    public async submitReview(userId: string, courseId: string, data: SubmitReview) {
        // 1. Verify course existence
        const course = await db.course.findFirst({
            where: { id: courseId, isPublished: true },
            select: { id: true },
        });

        if (!course) {
            throw new APIError(httpStatus.NOT_FOUND, "Course not found");
        }

        // 2. Check enrollment
        const enrollment = await db.enrollment.findUnique({
            where: {
                userId_courseId: { userId, courseId },
            },
            select: { id: true, status: true },
        });

        if (!enrollment || enrollment.status !== "ACTIVE") {
            throw new APIError(
                httpStatus.FORBIDDEN,
                "You must be enrolled in this course to leave a review"
            );
        }

        // 3. Verify user has completed at least 1 lesson
        const completedLessonsCount = await db.lessonProgress.count({
            where: {
                userId,
                status: "COMPLETED",
                lesson: { module: { courseId } },
            },
        });

        if (completedLessonsCount === 0) {
            throw new APIError(
                httpStatus.FORBIDDEN,
                "You must complete at least one lesson before reviewing this course"
            );
        }

        // 4. Check if user already reviewed
        const existingReview = await db.review.findUnique({
            where: {
                userId_courseId: { userId, courseId },
            },
            select: { id: true },
        });

        if (existingReview) {
            throw new APIError(
                httpStatus.CONFLICT,
                "You have already reviewed this course. Use PUT to update your review."
            );
        }

        // 5. Create review
        const review = await db.review.create({
            data: {
                userId,
                courseId,
                rating: data.rating,
                comment: data.comment,
            },
            select: {
                id: true,
                rating: true,
                comment: true,
                createdAt: true,
                user: {
                    select: { id: true, name: true },
                },
            },
        });

        return review;
    }

    /**
     * PUT /v1/courses/:courseId/reviews
     * Allows a user to edit their existing review for a course.
     */
    public async updateReview(userId: string, courseId: string, data: SubmitReview) {
        const existingReview = await db.review.findUnique({
            where: {
                userId_courseId: { userId, courseId },
            },
            select: { id: true },
        });

        if (!existingReview) {
            throw new APIError(
                httpStatus.NOT_FOUND,
                "You have not reviewed this course yet"
            );
        }

        const updatedReview = await db.review.update({
            where: {
                userId_courseId: { userId, courseId },
            },
            data: {
                rating: data.rating,
                comment: data.comment,
            },
            select: {
                id: true,
                rating: true,
                comment: true,
                createdAt: true,
                user: {
                    select: { id: true, name: true },
                },
            },
        });

        return updatedReview;
    }

    /**
     * DELETE /v1/courses/:courseId/reviews
     * Allows a user to delete their own review for a course.
     */
    public async deleteReview(userId: string, courseId: string) {
        const existingReview = await db.review.findUnique({
            where: {
                userId_courseId: { userId, courseId },
            },
            select: { id: true },
        });

        if (!existingReview) {
            throw new APIError(httpStatus.NOT_FOUND, "Review not found");
        }

        await db.review.delete({
            where: {
                userId_courseId: { userId, courseId },
            },
        });

        return { message: "Review deleted successfully" };
    }

    /**
     * GET /v1/courses/:courseId/reviews
     * Returns paginated reviews for a course along with rating statistics & breakdown.
     */
    public async getCourseReviews(
        courseId: string,
        query: { cursor?: string; limit?: number; rating?: number }
    ) {
        const limit = query.limit ?? 20;
        const { cursor, rating } = query;

        // 1. Verify course existence
        const course = await db.course.findFirst({
            where: { id: courseId, isPublished: true },
            select: { id: true },
        });

        if (!course) {
            throw new APIError(httpStatus.NOT_FOUND, "Course not found");
        }

        // 2. Fetch rating aggregate & rating distribution
        const ratingAggregate = await db.review.aggregate({
            where: { courseId },
            _avg: { rating: true },
            _count: { rating: true },
        });

        const ratingGroups = await db.review.groupBy({
            by: ["rating"],
            where: { courseId },
            _count: { rating: true },
        });

        const distribution: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
        for (const group of ratingGroups) {
            distribution[group.rating] = group._count.rating;
        }

        const totalReviews = ratingAggregate._count.rating;
        const avgRating = ratingAggregate._avg.rating
            ? Math.round(ratingAggregate._avg.rating * 10) / 10
            : null;

        // 3. Fetch paginated reviews
        const reviews = await db.review.findMany({
            where: {
                courseId,
                ...(rating && { rating }),
            },
            ...(cursor && { cursor: { id: cursor }, skip: 1 }),
            take: limit,
            orderBy: { createdAt: "desc" },
            select: {
                id: true,
                rating: true,
                comment: true,
                createdAt: true,
                user: {
                    select: { id: true, name: true },
                },
            },
        });

        const nextCursor =
            reviews.length === limit ? reviews[reviews.length - 1].id : null;

        return {
            reviews,
            nextCursor,
            stats: {
                totalReviews,
                avgRating,
                distribution,
            },
        };
    }
}

export const courseService = new CourseService();
