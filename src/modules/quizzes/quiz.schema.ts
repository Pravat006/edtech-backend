import { z } from "zod";

export const QuestionOptionSchema = z.object({
    id: z.string().min(1),
    text: z.string().min(1),
});

export const UpsertQuestionSchema = z.object({
    id: z.string().optional(), // If provided, update existing. Else create new.
    text: z.string().min(1, "Question text is required"),
    options: z.array(QuestionOptionSchema).min(2, "At least 2 options required"),
    correctOptionId: z.string().min(1, "Correct option ID is required"),
});

export const UpsertQuizSchema = z.object({
    title: z.string().min(1, "Quiz title is required"),
    questions: z.array(UpsertQuestionSchema).min(1, "At least 1 question is required"),
});
export type UpsertQuiz = z.infer<typeof UpsertQuizSchema>;

export const SubmitQuizAttemptSchema = z.object({
    answers: z.record(z.string(), z.string()), // QuestionId -> OptionId
});
export type SubmitQuizAttempt = z.infer<typeof SubmitQuizAttemptSchema>;
