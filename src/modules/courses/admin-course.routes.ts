import { Router } from "express";
import { verifyAdmin } from "@/middlewares/verifyAdmin";
import * as adminCourseController from "./admin-course.controller";
import { adminQuizRouter } from "../quizzes/quiz.routes";

const router = Router();

router.use(verifyAdmin);

router.get("/", adminCourseController.listCourses);
router.post("/", adminCourseController.createCourse);
router.put("/:courseId", adminCourseController.updateCourse);
router.patch("/:courseId/publish", adminCourseController.togglePublishCourse);

router.get("/:courseId/modules", adminCourseController.getCourseModules);
router.post("/:courseId/modules", adminCourseController.createModule);
router.put("/:courseId/modules/:moduleId", adminCourseController.updateModule);
router.delete("/:courseId/modules/:moduleId", adminCourseController.deleteModule);
router.post("/:courseId/modules/:moduleId/lessons", adminCourseController.createLesson);
router.put(
    "/:courseId/modules/:moduleId/lessons/:lessonId",
    adminCourseController.updateLesson
);
router.delete(
    "/:courseId/modules/:moduleId/lessons/:lessonId",
    adminCourseController.deleteLesson
);

router.use("/:courseId/modules/:moduleId/lessons/:lessonId/quiz", adminQuizRouter);

// Reorder endpoints must be defined BEFORE parameterized :contentId endpoints to prevent "reorder" from matching :contentId
router.patch("/:courseId/modules/reorder", adminCourseController.reorderModules);
router.patch("/:courseId/modules/:moduleId/lessons/reorder", adminCourseController.reorderLessons);
router.patch(
    "/:courseId/modules/:moduleId/lessons/:lessonId/contents/reorder",
    adminCourseController.reorderLessonContents
);
router.patch("/lessons/:lessonId/blocks/reorder", adminCourseController.reorderLessonBlocks);
router.patch("/lessons/:lessonId/contents/reorder", adminCourseController.reorderLessonBlocks);
router.patch("/:courseId/lessons/:lessonId/blocks/reorder", adminCourseController.reorderLessonBlocks);
router.post("/modules/lessons/blocks/reorder", adminCourseController.reorderLessonBlocks);

router.post(
    "/:courseId/modules/:moduleId/lessons/:lessonId/contents",
    adminCourseController.addLessonContent
);
router.patch(
    "/:courseId/modules/:moduleId/lessons/:lessonId/contents/:contentId",
    adminCourseController.updateLessonContent
);
router.delete(
    "/:courseId/modules/:moduleId/lessons/:lessonId/contents/:contentId",
    adminCourseController.deleteLessonContent
);

router.get("/:courseId/analytics", adminCourseController.getCourseAnalytics);
router.get("/:courseId/preview", adminCourseController.getCoursePreview);

export default router;
