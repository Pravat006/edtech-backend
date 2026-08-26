import { db } from "@/config/database";

export interface FormattedCourseContext {
    courseId: string;
    courseTitle: string;
    courseDescription?: string;
    lessonId?: string;
    lessonTitle?: string;
    lessonContent?: string;
    summaryText: string;
}

export class CourseContextService {
    public async getContext(courseId?: string, lessonId?: string): Promise<FormattedCourseContext> {
        if (!courseId) {
            return {
                courseId: "",
                courseTitle: "General Knowledge & Doubt Solver",
                summaryText: "GENERAL AI TUTOR MODE: You are an expert AI study assistant. Provide clear step-by-step explanations, code examples, math solutions, and educational concept breakdowns across any subject or topic asked by the student.",
            };
        }

        const course = await db.course.findUnique({
            where: { id: courseId },
            select: { id: true, title: true, description: true },
        });

        let lessonInfo: { id: string; title: string; contentText?: string } | undefined;

        if (lessonId) {
            const lesson = await db.lesson.findUnique({
                where: { id: lessonId },
                include: {
                    contents: {
                        orderBy: { order: "asc" },
                        take: 3,
                    },
                },
            });

            if (lesson) {
                const combinedContent = lesson.contents
                    .map((c: { body?: string | null; title?: string | null }) => c.body || c.title)
                    .filter(Boolean)
                    .join("\n\n");

                lessonInfo = {
                    id: lesson.id,
                    title: lesson.title,
                    contentText: combinedContent.slice(0, 2500),
                };
            }
        }

        let summaryText = `COURSE TITLE: "${course?.title || "Unknown Course"}"\n`;
        if (course?.description) {
            summaryText += `COURSE OVERVIEW: ${course.description.slice(0, 500)}\n`;
        }

        if (lessonInfo) {
            summaryText += `CURRENT LESSON: "${lessonInfo.title}"\n`;
            if (lessonInfo.contentText) {
                summaryText += `LESSON MATERIAL:\n${lessonInfo.contentText}\n`;
            }
        }

        return {
            courseId,
            courseTitle: course?.title || "",
            courseDescription: course?.description || "",
            lessonId,
            lessonTitle: lessonInfo?.title,
            lessonContent: lessonInfo?.contentText,
            summaryText,
        };
    }
}

export const courseContextService = new CourseContextService();
