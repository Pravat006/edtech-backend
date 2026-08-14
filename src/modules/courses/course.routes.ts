import { Router } from "express";
import { authenticateUser } from "@/middlewares/auth.middleware";
import * as courseController from "./course.controller";

const router = Router();

// All course routes require authentication
router.use(authenticateUser);

// ─── Discovery & Browsing ─────────────────────────────────────────────────────
router.get("/", courseController.getCourses);
// NOTE: Static subpaths (/for-you, /my-courses) must come before /:courseId
router.get("/for-you", courseController.getPersonalisedCourses);
router.get("/my-courses", courseController.getMyCourses);
router.get("/:courseId", courseController.getCourseDetail);

// ─── Learning ────────────────────────────────────────────────────────────────
router.get("/:courseId/learn", courseController.getLearnData);
router.patch(
    "/:courseId/lessons/:lessonId/progress",
    courseController.updateLessonProgress
);

// ─── Reviews ─────────────────────────────────────────────────────────────────
router.get("/:courseId/reviews", courseController.getCourseReviews);
router.post("/:courseId/reviews", courseController.submitReview);
router.put("/:courseId/reviews", courseController.updateReview);
router.delete("/:courseId/reviews", courseController.deleteReview);

// TODO: next endpoints will be added here one by one

export default router;
