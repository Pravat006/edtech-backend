import { Request, Response, NextFunction } from "express";
import { ZodSchema, ZodError } from "zod";
import httpStatus from "http-status";
import { APIError } from "@/utils/APIError";

export const validateRequest = (schema: ZodSchema) => {
    return async (req: Request, res: Response, next: NextFunction) => {
        try {
            await schema.parseAsync(req.body);
            next();
        } catch (error) {
            if (error instanceof ZodError) {
                const message = error.issues.map(err => `${err.path.join(".")}: ${err.message}`).join(", ");
                next(new APIError(httpStatus.BAD_REQUEST, message));
            } else {
                next(new APIError(httpStatus.INTERNAL_SERVER_ERROR, "Internal Server Error during validation"));
            }
        }
    };
};
