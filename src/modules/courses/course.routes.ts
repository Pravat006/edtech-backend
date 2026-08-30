import { Router } from "express";
import { authenticateUser } from "@/middlewares/auth.middleware";
import * as courseController from "./course.controller";
import { publicQuizRouter } from "../quizzes/quiz.routes";

const router = Router();

router.use(authenticateUser);

router.get("/", courseController.getCourses);

router.get("/for-you", courseController.getPersonalisedCourses);
router.get("/my-courses", courseController.getMyCourses);
router.get("/:courseId", courseController.getCourseDetail);

router.get("/:courseId/learn", courseController.getLearnData);
router.get("/:courseId/lessons/:lessonId/content", courseController.getLessonContent);
router.patch(
    "/:courseId/lessons/:lessonId/progress",
    courseController.updateLessonProgress
);

router.use("/:courseId/lessons/:lessonId/quiz", publicQuizRouter);

router.get("/:courseId/reviews", courseController.getCourseReviews);
router.post("/:courseId/reviews", courseController.submitReview);
router.put("/:courseId/reviews", courseController.updateReview);
router.delete("/:courseId/reviews", courseController.deleteReview);

export default router;
