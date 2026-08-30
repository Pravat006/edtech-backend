import { Router } from "express";
import { CalendarController } from "./calendar.controller";
import { validateRequest } from "@/middlewares/validateRequest";
import { CalendarQuerySchema } from "./calendar.schema";
import { optionalAuthenticateUser } from "@/middlewares/auth.middleware";

export const calendarRouter = Router();

// extractUserOptional is a middleware that parses the JWT token if present,
// attaching req.user, but does not throw an error if missing.
// We need this so that non-logged-in users can still fetch public dates.
calendarRouter.get(
    "/",
    optionalAuthenticateUser,
    validateRequest(CalendarQuerySchema, "query"),
    CalendarController.getMonthlyCalendar
);
