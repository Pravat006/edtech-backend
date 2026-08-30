import { db } from "@/config/database";
import httpStatus from "http-status";
import { APIError } from "@/utils/APIError";
import { UpsertQuiz, SubmitQuizAttempt } from "./quiz.schema";

export class QuizService {
    // --- Admin Endpoints ---

    static async upsertQuiz(lessonId: string, data: UpsertQuiz) {
        const lesson = await db.lesson.findUnique({
            where: { id: lessonId },
            select: { id: true },
        });

        if (!lesson) {
            throw new APIError(httpStatus.NOT_FOUND, "Lesson not found");
        }

        // Delete existing quiz to recreate (easiest way to handle nested upserts cleanly)
        const existingQuiz = await db.quiz.findUnique({ where: { lessonId } });
        if (existingQuiz) {
            await db.quiz.delete({ where: { lessonId } });
        }

        const quiz = await db.quiz.create({
            data: {
                lessonId,
                title: data.title,
                questions: {
                    create: data.questions.map((q, index) => {
                        // Validate that correctOptionId exists in options
                        const isValidCorrectOption = q.options.some(opt => opt.id === q.correctOptionId);
                        if (!isValidCorrectOption) {
                            throw new APIError(httpStatus.BAD_REQUEST, `Invalid correctOptionId for question: ${q.text}`);
                        }

                        return {
                            text: q.text,
                            options: JSON.stringify(q.options),
                            correctOptionId: q.correctOptionId,
                            order: index + 1,
                        };
                    }),
                },
            },
            include: { questions: true },
        });

        return quiz;
    }

    static async getAdminQuiz(lessonId: string) {
        const quiz = await db.quiz.findUnique({
            where: { lessonId },
            include: {
                questions: {
                    orderBy: { order: "asc" },
                },
            },
        });

        if (!quiz) {
            throw new APIError(httpStatus.NOT_FOUND, "Quiz not found for this lesson");
        }

        return quiz;
    }

    // --- Student Endpoints ---

    static async getStudentQuiz(lessonId: string, userId: string) {
        // Validation: Must be enrolled and lesson must be unlocked
        const lesson = await db.lesson.findUnique({
            where: { id: lessonId },
            include: { module: { include: { course: true } } },
        });

        if (!lesson) {
            throw new APIError(httpStatus.NOT_FOUND, "Lesson not found");
        }

        if (!lesson.isFreePreview) {
            const enrollment = await db.enrollment.findUnique({
                where: { userId_courseId: { userId, courseId: lesson.module.courseId } },
            });
            if (!enrollment || enrollment.status !== "ACTIVE") {
                throw new APIError(httpStatus.FORBIDDEN, "You are not enrolled in this course");
            }
        }

        const quiz = await db.quiz.findUnique({
            where: { lessonId },
            include: {
                questions: {
                    orderBy: { order: "asc" },
                    // DO NOT SELECT correctOptionId!
                    select: {
                        id: true,
                        text: true,
                        options: true,
                        order: true,
                    },
                },
            },
        });

        if (!quiz) {
            throw new APIError(httpStatus.NOT_FOUND, "Quiz not found");
        }

        return quiz;
    }

    static async submitQuizAttempt(lessonId: string, userId: string, data: SubmitQuizAttempt) {
        const quiz = await db.quiz.findUnique({
            where: { lessonId },
            include: { questions: true },
        });

        if (!quiz) {
            throw new APIError(httpStatus.NOT_FOUND, "Quiz not found");
        }

        // Calculate score
        let score = 0;
        const totalQuestions = quiz.questions.length;

        quiz.questions.forEach((question) => {
            const studentAnswer = data.answers[question.id];
            if (studentAnswer && studentAnswer === question.correctOptionId) {
                score += 1;
            }
        });

        const percentScore = Math.round((score / totalQuestions) * 100);

        // Save Attempt
        const attempt = await db.quizAttempt.create({
            data: {
                userId,
                quizId: quiz.id,
                answers: JSON.stringify(data.answers),
                score: percentScore,
            },
        });

        return {
            attemptId: attempt.id,
            score: percentScore,
            totalQuestions,
            correctAnswers: score,
        };
    }
}
