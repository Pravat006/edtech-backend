import { Request, Response } from "express";
import { supportService } from "./support.service";
import status from "http-status";
import { z } from "zod";

const createTicketSchema = z.object({
    subject: z.string().min(3, "Subject must be at least 3 characters").max(200),
    category: z.enum(["TECHNICAL", "BILLING_PAYMENT", "COURSE_ACCESS", "ACCOUNT", "OTHER"]).optional(),
    priority: z.enum(["LOW", "MEDIUM", "HIGH", "URGENT"]).optional(),
    message: z.string().min(5, "Message must be at least 5 characters"),
    attachmentMediaIds: z.array(z.string().uuid()).optional(),
});

const addMessageSchema = z.object({
    message: z.string().min(1, "Message cannot be empty"),
    attachmentMediaIds: z.array(z.string().uuid()).optional(),
});

/**
 * POST /v1/support/tickets
 */
export const createTicket = async (req: Request, res: Response) => {
    const userId = req.user!.id;
    const body = createTicketSchema.parse(req.body);

    const ticket = await supportService.createTicket(userId, body);
    res.status(status.CREATED).json({
        success: true,
        message: "Support ticket created successfully",
        data: ticket,
    });
};

/**
 * GET /v1/support/tickets
 */
export const getUserTickets = async (req: Request, res: Response) => {
    const userId = req.user!.id;
    const { status: ticketStatus, page, limit } = req.query;

    const result = await supportService.getUserTickets(userId, {
        status: ticketStatus as any,
        page: page ? parseInt(page as string, 10) : 1,
        limit: limit ? parseInt(limit as string, 10) : 10,
    });

    res.status(status.OK).json({
        success: true,
        data: result.items,
        pagination: result.pagination,
    });
};

/**
 * GET /v1/support/tickets/:ticketId
 */
export const getTicketDetail = async (req: Request, res: Response) => {
    const userId = req.user!.id;
    const { ticketId } = req.params;

    const ticket = await supportService.getTicketDetail(userId, ticketId);
    res.status(status.OK).json({
        success: true,
        data: ticket,
    });
};

/**
 * POST /v1/support/tickets/:ticketId/messages
 */
export const addMessage = async (req: Request, res: Response) => {
    const userId = req.user!.id;
    const { ticketId } = req.params;
    const body = addMessageSchema.parse(req.body);

    const message = await supportService.addMessage(userId, ticketId, body);
    res.status(status.CREATED).json({
        success: true,
        message: "Reply sent successfully",
        data: message,
    });
};

import { supportEventEmitter } from "./support.events";

/**
 * PATCH /v1/support/tickets/:ticketId/close
 */
export const closeTicket = async (req: Request, res: Response) => {
    const userId = req.user!.id;
    const { ticketId } = req.params;

    const ticket = await supportService.closeTicket(userId, ticketId);
    res.status(status.OK).json({
        success: true,
        message: "Ticket marked as resolved",
        data: ticket,
    });
};

/**
 * GET /v1/support/tickets/:ticketId/stream
 * Real-time Server-Sent Events (SSE) channel for instant messages
 */
export const streamTicketMessages = async (req: Request, res: Response) => {
    const userId = req.user!.id;
    const { ticketId } = req.params;

    try {
        await supportService.getTicketDetail(userId, ticketId);
    } catch (err) {
        res.status(status.NOT_FOUND).json({ success: false, message: "Ticket not found" });
        return;
    }

    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.flushHeaders?.();

    const channel = `ticket:${ticketId}`;
    const listener = (event: any) => {
        res.write(`data: ${JSON.stringify(event)}\n\n`);
    };

    supportEventEmitter.on(channel, listener);

    // Heartbeat ping every 15 seconds
    const heartbeat = setInterval(() => {
        res.write(`:ping\n\n`);
    }, 15000);

    req.on("close", () => {
        clearInterval(heartbeat);
        supportEventEmitter.off(channel, listener);
    });
};
