import { Router } from "express";
import { verifyAdmin } from "@/middlewares/verifyAdmin";
import * as adminCourseController from "./admin-course.controller";

const router = Router();

router.use(verifyAdmin);

router.post("/", adminCourseController.createCourse);
router.put("/:courseId", adminCourseController.updateCourse);
router.patch("/:courseId/publish", adminCourseController.togglePublishCourse);

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

router.post(
    "/:courseId/modules/:moduleId/lessons/:lessonId/contents",
    adminCourseController.addLessonContent
);
router.delete(
    "/:courseId/modules/:moduleId/lessons/:lessonId/contents/:contentId",
    adminCourseController.deleteLessonContent
);

router.get("/:courseId/analytics", adminCourseController.getCourseAnalytics);
router.get("/:courseId/preview", adminCourseController.getCoursePreview);

export default router;
