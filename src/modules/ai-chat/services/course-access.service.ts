import httpStatus from "http-status";
import { db } from "@/config/database";
import { APIError } from "@/utils/APIError";

export class CourseAccessService {
    /**
     * Verifies course existence and student enrollment
     */
    public async verifyCourseAccess(userId: string, courseId: string): Promise<void> {
        const course = await db.course.findUnique({
            where: { id: courseId },
            select: { id: true, isPublished: true },
        });

        if (!course) {
            throw new APIError(httpStatus.NOT_FOUND, "Course not found");
        }

        const enrollment = await db.enrollment.findUnique({
            where: {
                userId_courseId: {
                    userId,
                    courseId,
                },
            },
        });

        if (!enrollment) {
            throw new APIError(
                httpStatus.FORBIDDEN,
                "You are not enrolled in this course to access the AI doubt solver"
            );
        }
    }

    /**
     * Verifies that the lesson belongs to the specified course
     */
    public async verifyLessonAccess(courseId: string, lessonId?: string): Promise<void> {
        if (!lessonId) return;

        const lesson = await db.lesson.findUnique({
            where: { id: lessonId },
            include: {
                module: {
                    select: { courseId: true },
                },
            },
        });

        if (!lesson || lesson.module.courseId !== courseId) {
            throw new APIError(
                httpStatus.BAD_REQUEST,
                "Specified lesson does not belong to this course"
            );
        }
    }
}

export const courseAccessService = new CourseAccessService();
