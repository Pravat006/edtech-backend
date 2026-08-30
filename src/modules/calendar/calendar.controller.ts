import { Request, Response } from "express";
import httpStatus from "http-status";
import { CalendarService } from "./calendar.service";

export class CalendarController {
    static async getMonthlyCalendar(req: Request, res: Response) {
        // req.user might be undefined if not authenticated, which is fine for "ALL" filter
        const userId = req.user?.id;
        
        const result = await CalendarService.getMonthlyCalendar(req.query as any, userId);
        
        res.status(httpStatus.OK).json({
            success: true,
            data: result,
        });
    }
}
