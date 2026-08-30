import { z } from "zod";
import { SubjectEnum, GoalEnum } from "../users/user.schema";

const LessonContentTypeEnum = z.enum(["VIDEO", "PDF", "TEXT"]);
const ProgressStatusEnum = z.enum(["NOT_STARTED", "IN_PROGRESS", "COMPLETED"]);

export const CreateCourseSchema = z.object({
    title: z.string().min(3, "Title must be at least 3 characters"),
    description: z.string().min(10, "Description must be at least 10 characters"),
    subject: SubjectEnum,
    language: z.string().min(2, "Language is required"),
    goals: z.array(GoalEnum).min(1, "At least one goal is required"),
    price: z.number().nonnegative("Price cannot be negative").default(0),
    isFree: z.boolean().default(false),
    accessDurationDays: z.number().int().positive().optional(),
    discountPrice: z.number().nonnegative().optional(),
    discountValidUntil: z.coerce.date().optional(),
    thumbnailMediaId: z.string().optional(),
});
export type CreateCourse = z.infer<typeof CreateCourseSchema>;

export const UpdateCourseSchema = CreateCourseSchema.partial();
export type UpdateCourse = z.infer<typeof UpdateCourseSchema>;


export const CreateModuleSchema = z.object({
    title: z.string().min(2, "Module title is required"),
    order: z.number().int().positive("Order must be a positive integer"),
    scheduledPublishDate: z.coerce.date().nullable().optional(),
});
export type CreateModule = z.infer<typeof CreateModuleSchema>;

export const UpdateModuleSchema = CreateModuleSchema.partial();
export type UpdateModule = z.infer<typeof UpdateModuleSchema>;

export const CreateLessonSchema = z.object({
    title: z.string().min(2, "Lesson title is required"),
    order: z.number().int().positive("Order must be a positive integer"),
    durationSec: z.number().int().nonnegative().optional(),
    unlockAfterDays: z.number().int().nonnegative().optional(),
    scheduledPublishDate: z.coerce.date().nullable().optional(),
    isFreePreview: z.boolean().default(false),
});
export type CreateLesson = z.infer<typeof CreateLessonSchema>;

export const UpdateLessonSchema = CreateLessonSchema.partial();
export type UpdateLesson = z.infer<typeof UpdateLessonSchema>;

export const CreateLessonContentSchema = z.object({
    type: LessonContentTypeEnum,
    order: z.number().int().positive(),
    title: z.string().optional(),
    body: z.string().optional(),
    mediaId: z.string().uuid().optional(),
});
export type CreateLessonContent = z.infer<typeof CreateLessonContentSchema>;

export const UpdateLessonContentSchema = CreateLessonContentSchema.partial();
export type UpdateLessonContent = z.infer<typeof UpdateLessonContentSchema>;

export const CourseListQuerySchema = z.object({
    subject: SubjectEnum.optional(),
    language: z.string().optional(),
    isFree: z
        .string()
        .optional()
        .transform((val) => val === "true" ? true : val === "false" ? false : undefined),
    search: z.string().optional(),
    cursor: z.string().uuid().optional(),
    limit: z.coerce.number().int().positive().max(50).default(20),
});
export type CourseListQuery = z.infer<typeof CourseListQuerySchema>;

export const SubmitReviewSchema = z.object({
    rating: z.number().int().min(1, "Minimum rating is 1").max(5, "Maximum rating is 5"),
    comment: z.string().max(1000).optional(),
});
export type SubmitReview = z.infer<typeof SubmitReviewSchema>;

export const UpdateProgressSchema = z.object({
    watchTimeSec: z.number().int().nonnegative(),
    lastPositionSec: z.number().int().nonnegative(),
    status: ProgressStatusEnum,
});
export type UpdateProgress = z.infer<typeof UpdateProgressSchema>;

const ReorderItemSchema = z.object({
    id: z.string().optional(),
    blockId: z.string().optional(),
    contentId: z.string().optional(),
    order: z.coerce.number().int().positive().optional(),
    newOrder: z.coerce.number().int().positive().optional(),
});

export const ReorderSchema = z.object({
    orders: z.array(ReorderItemSchema).optional(),
    blocks: z.array(ReorderItemSchema).optional(),
    contents: z.array(ReorderItemSchema).optional(),
});
export type ReorderPayload = z.infer<typeof ReorderSchema>;
