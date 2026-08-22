import { Request, Response, NextFunction, RequestHandler } from "express";

export const catchAsync = (fn: Function): RequestHandler => {
    return (req: Request, res: Response, next: NextFunction) => {
        Promise.resolve(fn(req, res, next)).catch((err) => next(err));
    };
};
