import { Request, Response } from "express";

export const paymentWebhook = (_req: Request, res: Response) => {
    res.status(200).json({ message: "Webhook module scaffolded." });
};

