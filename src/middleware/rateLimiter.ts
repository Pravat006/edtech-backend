import type { NextFunction, Request, Response } from "express";

export const rateLimiter = (_req: Request, _res: Response, next: NextFunction) => {
    next();
};

