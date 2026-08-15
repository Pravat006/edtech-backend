import { Request, Response } from "express";
import httpStatus from "http-status";
import { courseService } from "./course.service";
import {
    CourseListQuerySchema,
    UpdateProgressSchema,
    SubmitReviewSchema,
} from "./course.schema";
import { APIError } from "@/utils/APIError";

export const getCourses = async (req: Request, res: Response) => {
    const parsed = CourseListQuerySchema.safeParse(req.query);
    if (!parsed.success) {
        throw new APIError(httpStatus.BAD_REQUEST, parsed.error.issues[0].message);
    }

    const result = await courseService.getCourses(req.user!.id, parsed.data);

    res.status(httpStatus.OK).json({
        success: true,
        data: result.courses,
        nextCursor: result.nextCursor,
    });
};

export const getPersonalisedCourses = async (req: Request, res: Response) => {
    const limit = req.query.limit ? Number(req.query.limit) : 20;

    const result = await courseService.getPersonalisedCourses(req.user!.id, limit);

    res.status(httpStatus.OK).json({
        success: true,
        data: result,
    });
};

export const getCourseDetail = async (req: Request, res: Response) => {
    const { courseId } = req.params;

    const course = await courseService.getCourseDetail(courseId, req.user!.id);

    res.status(httpStatus.OK).json({
        success: true,
        data: course,
    });
};

export const getMyCourses = async (req: Request, res: Response) => {
    const courses = await courseService.getMyCourses(req.user!.id);

    res.status(httpStatus.OK).json({
        success: true,
        data: courses,
    });
};

export const getLearnData = async (req: Request, res: Response) => {
    const { courseId } = req.params;

    const learnData = await courseService.getLearnData(courseId, req.user!.id);

    res.status(httpStatus.OK).json({
        success: true,
        data: learnData,
    });
};

export const getLessonContent = async (req: Request, res: Response) => {
    const { courseId, lessonId } = req.params;

    const content = await courseService.getLessonContent(courseId, lessonId, req.user!.id);

    res.status(httpStatus.OK).json({
        success: true,
        data: content,
    });
};

export const updateLessonProgress = async (req: Request, res: Response) => {
    const { courseId, lessonId } = req.params;

    const parsed = UpdateProgressSchema.safeParse(req.body);
    if (!parsed.success) {
        throw new APIError(httpStatus.BAD_REQUEST, parsed.error.issues[0].message);
    }

    const result = await courseService.updateLessonProgress(
        req.user!.id,
        courseId,
        lessonId,
        parsed.data
    );

    res.status(httpStatus.OK).json({
        success: true,
        data: result.progress,
        certificateIssued: result.certificateIssued,
        ...(result.message && { message: result.message }),
    });
};

export const submitReview = async (req: Request, res: Response) => {
    const { courseId } = req.params;

    const parsed = SubmitReviewSchema.safeParse(req.body);
    if (!parsed.success) {
        throw new APIError(httpStatus.BAD_REQUEST, parsed.error.issues[0].message);
    }

    const review = await courseService.submitReview(
        req.user!.id,
        courseId,
        parsed.data
    );

    res.status(httpStatus.CREATED).json({
        success: true,
        message: "Review submitted successfully",
        data: review,
    });
};

export const updateReview = async (req: Request, res: Response) => {
    const { courseId } = req.params;

    const parsed = SubmitReviewSchema.safeParse(req.body);
    if (!parsed.success) {
        throw new APIError(httpStatus.BAD_REQUEST, parsed.error.issues[0].message);
    }

    const review = await courseService.updateReview(
        req.user!.id,
        courseId,
        parsed.data
    );

    res.status(httpStatus.OK).json({
        success: true,
        message: "Review updated successfully",
        data: review,
    });
};

export const deleteReview = async (req: Request, res: Response) => {
    const { courseId } = req.params;

    const result = await courseService.deleteReview(req.user!.id, courseId);

    res.status(httpStatus.OK).json({
        success: true,
        message: result.message,
    });
};

export const getCourseReviews = async (req: Request, res: Response) => {
    const { courseId } = req.params;
    const { cursor, limit, rating } = req.query;

    const result = await courseService.getCourseReviews(courseId, {
        cursor: cursor as string | undefined,
        limit: limit ? Number(limit) : undefined,
        rating: rating ? Number(rating) : undefined,
    });

    res.status(httpStatus.OK).json({
        success: true,
        data: result.reviews,
        nextCursor: result.nextCursor,
        stats: result.stats,
    });
};
