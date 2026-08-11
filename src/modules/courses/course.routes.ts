import { Router } from "express";
import { notImplementedCourses } from "./course.controller";

const router = Router();

router.get("/", notImplementedCourses);

export default router;

