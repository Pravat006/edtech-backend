import { Request, Response } from "express";
import httpStatus from "http-status";
import { QuizService } from "./quiz.service";

export class QuizController {
    // --- Admin Endpoints ---
    static async upsertQuiz(req: Request, res: Response) {
        const { lessonId } = req.params;
        const quiz = await QuizService.upsertQuiz(lessonId, req.body);
        res.status(httpStatus.CREATED).json({ success: true, message: "Quiz saved successfully", data: quiz });
    }

    static async getAdminQuiz(req: Request, res: Response) {
        const { lessonId } = req.params;
        const quiz = await QuizService.getAdminQuiz(lessonId);
        res.status(httpStatus.OK).json({ success: true, message: "Quiz fetched successfully", data: quiz });
    }

    // --- Student Endpoints ---
    static async getStudentQuiz(req: Request, res: Response) {
        const { lessonId } = req.params;
        const quiz = await QuizService.getStudentQuiz(lessonId, req.user!.id);
        res.status(httpStatus.OK).json({ success: true, message: "Quiz fetched successfully", data: quiz });
    }

    static async submitQuizAttempt(req: Request, res: Response) {
        const { lessonId } = req.params;
        const result = await QuizService.submitQuizAttempt(lessonId, req.user!.id, req.body);
        res.status(httpStatus.OK).json({ success: true, message: "Quiz submitted successfully", data: result });
    }
}
