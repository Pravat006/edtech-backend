import { Request, Response } from "express";
import httpStatus from "http-status";
import { adminCourseService } from "./admin-course.service";
import {
    CreateCourseSchema,
    UpdateCourseSchema,
    CreateModuleSchema,
    UpdateModuleSchema,
    CreateLessonSchema,
    UpdateLessonSchema,
    CreateLessonContentSchema,
} from "./course.schema";
import { APIError } from "@/utils/APIError";

export const createCourse = async (req: Request, res: Response) => {
    const parsed = CreateCourseSchema.safeParse(req.body);
    if (!parsed.success) {
        throw new APIError(httpStatus.BAD_REQUEST, parsed.error.issues[0].message);
    }

    const course = await adminCourseService.createCourse(req.admin!.id, parsed.data);

    res.status(httpStatus.CREATED).json({
        success: true,
        message: "Course created successfully as draft",
        data: course,
    });
};

export const updateCourse = async (req: Request, res: Response) => {
    const { courseId } = req.params;

    const parsed = UpdateCourseSchema.safeParse(req.body);
    if (!parsed.success) {
        throw new APIError(httpStatus.BAD_REQUEST, parsed.error.issues[0].message);
    }

    const course = await adminCourseService.updateCourse(
        courseId,
        req.admin!.id,
        req.admin!.role,
        parsed.data
    );

    res.status(httpStatus.OK).json({
        success: true,
        message: "Course details updated successfully",
        data: course,
    });
};

export const togglePublishCourse = async (req: Request, res: Response) => {
    const { courseId } = req.params;

    const result = await adminCourseService.togglePublishCourse(
        courseId,
        req.admin!.id,
        req.admin!.role
    );

    res.status(httpStatus.OK).json({
        success: true,
        message: result.message,
        data: result.course,
    });
};

export const createModule = async (req: Request, res: Response) => {
    const { courseId } = req.params;

    const parsed = CreateModuleSchema.safeParse(req.body);
    if (!parsed.success) {
        throw new APIError(httpStatus.BAD_REQUEST, parsed.error.issues[0].message);
    }

    const module = await adminCourseService.createModule(
        courseId,
        req.admin!.id,
        req.admin!.role,
        parsed.data
    );

    res.status(httpStatus.CREATED).json({
        success: true,
        message: "Module created successfully",
        data: module,
    });
};

export const updateModule = async (req: Request, res: Response) => {
    const { courseId, moduleId } = req.params;

    const parsed = UpdateModuleSchema.safeParse(req.body);
    if (!parsed.success) {
        throw new APIError(httpStatus.BAD_REQUEST, parsed.error.issues[0].message);
    }

    const module = await adminCourseService.updateModule(
        courseId,
        moduleId,
        req.admin!.id,
        req.admin!.role,
        parsed.data
    );

    res.status(httpStatus.OK).json({
        success: true,
        message: "Module updated successfully",
        data: module,
    });
};

export const deleteModule = async (req: Request, res: Response) => {
    const { courseId, moduleId } = req.params;

    const result = await adminCourseService.deleteModule(
        courseId,
        moduleId,
        req.admin!.id,
        req.admin!.role
    );

    res.status(httpStatus.OK).json({
        success: true,
        message: result.message,
    });
};

export const createLesson = async (req: Request, res: Response) => {
    const { courseId, moduleId } = req.params;

    const parsed = CreateLessonSchema.safeParse(req.body);
    if (!parsed.success) {
        throw new APIError(httpStatus.BAD_REQUEST, parsed.error.issues[0].message);
    }

    const lesson = await adminCourseService.createLesson(
        courseId,
        moduleId,
        req.admin!.id,
        req.admin!.role,
        parsed.data
    );

    res.status(httpStatus.CREATED).json({
        success: true,
        message: "Lesson created successfully",
        data: lesson,
    });
};

export const updateLesson = async (req: Request, res: Response) => {
    const { courseId, moduleId, lessonId } = req.params;

    const parsed = UpdateLessonSchema.safeParse(req.body);
    if (!parsed.success) {
        throw new APIError(httpStatus.BAD_REQUEST, parsed.error.issues[0].message);
    }

    const lesson = await adminCourseService.updateLesson(
        courseId,
        moduleId,
        lessonId,
        req.admin!.id,
        req.admin!.role,
        parsed.data
    );

    res.status(httpStatus.OK).json({
        success: true,
        message: "Lesson updated successfully",
        data: lesson,
    });
};

export const deleteLesson = async (req: Request, res: Response) => {
    const { courseId, moduleId, lessonId } = req.params;

    const result = await adminCourseService.deleteLesson(
        courseId,
        moduleId,
        lessonId,
        req.admin!.id,
        req.admin!.role
    );

    res.status(httpStatus.OK).json({
        success: true,
        message: result.message,
    });
};

export const addLessonContent = async (req: Request, res: Response) => {
    const { courseId, moduleId, lessonId } = req.params;

    const parsed = CreateLessonContentSchema.safeParse(req.body);
    if (!parsed.success) {
        throw new APIError(httpStatus.BAD_REQUEST, parsed.error.issues[0].message);
    }

    const content = await adminCourseService.addLessonContent(
        courseId,
        moduleId,
        lessonId,
        req.admin!.id,
        req.admin!.role,
        parsed.data
    );

    res.status(httpStatus.CREATED).json({
        success: true,
        message: "Lesson content block added successfully",
        data: content,
    });
};

export const deleteLessonContent = async (req: Request, res: Response) => {
    const { courseId, moduleId, lessonId, contentId } = req.params;

    const result = await adminCourseService.deleteLessonContent(
        courseId,
        moduleId,
        lessonId,
        contentId,
        req.admin!.id,
        req.admin!.role
    );

    res.status(httpStatus.OK).json({
        success: true,
        message: result.message,
    });
};

export const getCourseAnalytics = async (req: Request, res: Response) => {
    const { courseId } = req.params;

    const analytics = await adminCourseService.getCourseAnalytics(
        courseId,
        req.admin!.id,
        req.admin!.role
    );

    res.status(httpStatus.OK).json({
        success: true,
        data: analytics,
    });
};

export const getCoursePreview = async (req: Request, res: Response) => {
    const { courseId } = req.params;

    const course = await adminCourseService.getCoursePreview(
        courseId,
        req.admin!.id,
        req.admin!.role
    );

    res.status(httpStatus.OK).json({
        success: true,
        previewMode: true,
        data: course,
    });
};
