import { Request, Response } from "express";

export const notImplementedCourses = (_req: Request, res: Response) => {
    res.status(200).json({ message: "Course module scaffolded." });
};

