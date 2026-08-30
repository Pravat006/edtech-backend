import { Router } from "express";
import { QuizController } from "./quiz.controller";
import { validateRequest } from "@/middlewares/validateRequest";
import { UpsertQuizSchema, SubmitQuizAttemptSchema } from "./quiz.schema";
import { requirePermission, verifyAdmin } from "@/middlewares/verifyAdmin";
import { authenticateUser } from "@/middlewares/auth.middleware";

// We will mount this on `/v1/admin/lessons/:lessonId/quiz`
export const adminQuizRouter = Router({ mergeParams: true });

adminQuizRouter.use(verifyAdmin);
adminQuizRouter.get(
    "/",
    requirePermission("courses:read"),
    QuizController.getAdminQuiz
);
adminQuizRouter.put(
    "/",
    requirePermission("courses:write"),
    validateRequest(UpsertQuizSchema),
    QuizController.upsertQuiz
);

// We will mount this on `/v1/courses/:courseId/lessons/:lessonId/quiz`
export const publicQuizRouter = Router({ mergeParams: true });

publicQuizRouter.use(authenticateUser);
publicQuizRouter.get(
    "/",
    QuizController.getStudentQuiz
);
publicQuizRouter.post(
    "/submit",
    validateRequest(SubmitQuizAttemptSchema),
    QuizController.submitQuizAttempt
);
