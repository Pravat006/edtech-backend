import { APIError } from "@/utils/APIError";
import { logger } from "@/config/logger";
import httpStatus from "http-status";
import type {
    ErrorRequestHandler,
    NextFunction,
    Request,
    Response,
} from "express";

export const errorConverter: ErrorRequestHandler = (
    err,
    _req: Request,
    _res: Response,
    next,
) => {
    let error = err;
    if (!(error instanceof APIError)) {
        const statusCode = error.statusCode || error instanceof Error ? httpStatus.INTERNAL_SERVER_ERROR : httpStatus.BAD_REQUEST;
        const message = error.message || String(statusCode);
        error = new APIError(statusCode, message);
        if (err instanceof Error && err.stack) {
            error.stack = err.stack;
        }
    }
    next(error);
};

export const errorHandler: ErrorRequestHandler = (
    err: APIError,
    _req: Request,
    res: Response,
    _next: NextFunction,
) => {
    const statusCode = err.statusCode || httpStatus.INTERNAL_SERVER_ERROR;
    
    // Mask internal error messages for 500s in production
    const isInternalError = statusCode === httpStatus.INTERNAL_SERVER_ERROR;
    const message = (isInternalError && process.env.NODE_ENV === "production") 
        ? "Internal Server Error" 
        : (err.message || String(statusCode));

    const response = {
        code: statusCode,
        message,
        ...(process.env.NODE_ENV === "development" && { stack: err.stack }),
    };

    if (isInternalError || process.env.NODE_ENV === "development") {
        logger.error(`[ERROR] ${statusCode} - ${err.message}`);
        if (err.stack) {
            logger.error(err.stack);
        }
    }

    res.status(statusCode).send(response);
};
