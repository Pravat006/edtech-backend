import { z } from "zod";

export const CalendarQuerySchema = z.object({
    year: z.string().regex(/^\d{4}$/, "Year must be a 4-digit number"),
    month: z.string().regex(/^(1[0-2]|[1-9])$/, "Month must be between 1 and 12"),
    courseId: z.string().uuid("Invalid courseId").optional(),
    filter: z.enum(["ALL", "ENROLLED", "NON_ENROLLED"]).optional().default("ALL"),
});

export type CalendarQuery = z.infer<typeof CalendarQuerySchema>;
