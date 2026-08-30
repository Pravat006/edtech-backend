import { db } from "@/config/database";
import { CalendarQuery } from "./calendar.schema";
import httpStatus from "http-status";
import { APIError } from "@/utils/APIError";

export interface CalendarEvent {
    type: "COURSE_LAUNCH" | "MODULE_UNLOCK" | "LESSON_UNLOCK";
    courseId: string;
    courseTitle: string;
    moduleId?: string;
    moduleTitle?: string;
    lessonId?: string;
    lessonTitle?: string;
    isEnrolled: boolean;
}

export class CalendarService {
    static async getMonthlyCalendar(query: CalendarQuery, userId?: string) {
        const year = parseInt(query.year);
        const month = parseInt(query.month) - 1; // JS months are 0-indexed

        // 1. Calculate Date Boundaries
        const startDate = new Date(Date.UTC(year, month, 1, 0, 0, 0, 0));
        const endDate = new Date(Date.UTC(year, month + 1, 0, 23, 59, 59, 999));

        // 2. Resolve User Enrollments (if filter is applied)
        let enrolledCourseIds = new Set<string>();
        if (userId) {
            const enrollments = await db.enrollment.findMany({
                where: { userId, status: "ACTIVE" },
                select: { courseId: true },
            });
            enrolledCourseIds = new Set(enrollments.map((e) => e.courseId));
        }

        if (query.filter !== "ALL" && !userId) {
            throw new APIError(httpStatus.UNAUTHORIZED, "Authentication required to filter by enrollment status");
        }

        // Base where clause for dates
        const dateWhere = {
            scheduledPublishDate: {
                gte: startDate,
                lte: endDate,
            },
        };

        // Course filter
        const courseWhere = query.courseId ? { id: query.courseId } : {};
        const nestedCourseWhere = query.courseId ? { courseId: query.courseId } : {};

        // 3. Concurrent Queries for Scheduled Content
        const [courses, modules, lessons] = await Promise.all([
            db.course.findMany({
                where: { ...dateWhere, ...courseWhere },
                select: { id: true, title: true, scheduledPublishDate: true },
            }),
            db.module.findMany({
                where: { ...dateWhere, ...nestedCourseWhere },
                select: { id: true, title: true, scheduledPublishDate: true, course: { select: { id: true, title: true } } },
            }),
            db.lesson.findMany({
                where: { ...dateWhere, module: nestedCourseWhere },
                select: { 
                    id: true, 
                    title: true, 
                    scheduledPublishDate: true, 
                    module: { select: { id: true, title: true, course: { select: { id: true, title: true } } } } 
                },
            }),
        ]);

        // 4. Map into uniform Event format
        let allEvents: Array<{ date: Date; event: CalendarEvent }> = [];

        courses.forEach((c) => {
            if (c.scheduledPublishDate) {
                allEvents.push({
                    date: c.scheduledPublishDate,
                    event: {
                        type: "COURSE_LAUNCH",
                        courseId: c.id,
                        courseTitle: c.title,
                        isEnrolled: enrolledCourseIds.has(c.id),
                    }
                });
            }
        });

        modules.forEach((m) => {
            if (m.scheduledPublishDate) {
                allEvents.push({
                    date: m.scheduledPublishDate,
                    event: {
                        type: "MODULE_UNLOCK",
                        courseId: m.course.id,
                        courseTitle: m.course.title,
                        moduleId: m.id,
                        moduleTitle: m.title,
                        isEnrolled: enrolledCourseIds.has(m.course.id),
                    }
                });
            }
        });

        lessons.forEach((l) => {
            if (l.scheduledPublishDate) {
                allEvents.push({
                    date: l.scheduledPublishDate,
                    event: {
                        type: "LESSON_UNLOCK",
                        courseId: l.module.course.id,
                        courseTitle: l.module.course.title,
                        moduleId: l.module.id,
                        moduleTitle: l.module.title,
                        lessonId: l.id,
                        lessonTitle: l.title,
                        isEnrolled: enrolledCourseIds.has(l.module.course.id),
                    }
                });
            }
        });

        // 5. Apply Enrollment Filter
        if (query.filter === "ENROLLED") {
            allEvents = allEvents.filter((e) => e.event.isEnrolled);
        } else if (query.filter === "NON_ENROLLED") {
            allEvents = allEvents.filter((e) => !e.event.isEnrolled);
        }

        // 6. Group by Day
        const daysInMonth: Date[] = [];
        let currentDay = new Date(startDate);
        while (currentDay <= endDate) {
            daysInMonth.push(new Date(currentDay));
            currentDay.setUTCDate(currentDay.getUTCDate() + 1);
        }
        
        const response = daysInMonth.map((day: Date) => {
            // Strip time for comparison (e.g. 2026-11-15)
            const dayString = day.toISOString().split("T")[0];
            
            const eventsForDay = allEvents
                .filter((e) => e.date.toISOString().split("T")[0] === dayString)
                .map((e) => e.event);

            return {
                date: dayString,
                events: eventsForDay,
            };
        });

        return response;
    }
}
