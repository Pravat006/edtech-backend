import { Request, Response } from "express";

export const paymentInfo = (_req: Request, res: Response) => {
    res.status(200).json({ message: "Payment module scaffolded." });
};

