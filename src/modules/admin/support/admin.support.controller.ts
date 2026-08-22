import { Request, Response } from "express";
import { adminSupportService } from "./admin.support.service";
import status from "http-status";
import { z } from "zod";

const adminReplySchema = z.object({
    message: z.string().min(1, "Reply message cannot be empty"),
    isInternalNote: z.boolean().optional(),
    attachmentMediaIds: z.array(z.string().uuid()).optional(),
});

const updateMetadataSchema = z.object({
    status: z.enum(["OPEN", "IN_PROGRESS", "WAITING_USER", "RESOLVED", "CLOSED"]).optional(),
    priority: z.enum(["LOW", "MEDIUM", "HIGH", "URGENT"]).optional(),
    assignedAdminId: z.string().uuid().nullable().optional(),
});

/**
 * GET /v1/admin/support/tickets
 */
export const getAllTickets = async (req: Request, res: Response) => {
    const { status: ticketStatus, priority, category, assignedAdminId, search, page, limit } = req.query;

    const result = await adminSupportService.getAllTickets({
        status: ticketStatus as any,
        priority: priority as any,
        category: category as any,
        assignedAdminId: assignedAdminId as string,
        search: search as string,
        page: page ? parseInt(page as string, 10) : 1,
        limit: limit ? parseInt(limit as string, 10) : 15,
    });

    res.status(status.OK).json({
        success: true,
        data: result.items,
        pagination: result.pagination,
    });
};

/**
 * GET /v1/admin/support/tickets/:ticketId
 */
export const getTicketDetail = async (req: Request, res: Response) => {
    const { ticketId } = req.params;
    const ticket = await adminSupportService.getTicketDetail(ticketId);

    res.status(status.OK).json({
        success: true,
        data: ticket,
    });
};

/**
 * POST /v1/admin/support/tickets/:ticketId/reply
 */
export const addAdminReply = async (req: Request, res: Response) => {
    const adminId = req.admin!.id;
    const { ticketId } = req.params;
    const body = adminReplySchema.parse(req.body);

    const message = await adminSupportService.addAdminReply(adminId, ticketId, body);
    res.status(status.CREATED).json({
        success: true,
        message: body.isInternalNote ? "Internal note added" : "Reply sent to user",
        data: message,
    });
};

/**
 * PATCH /v1/admin/support/tickets/:ticketId/metadata
 */
export const updateTicketMetadata = async (req: Request, res: Response) => {
    const { ticketId } = req.params;
    const body = updateMetadataSchema.parse(req.body);

    const ticket = await adminSupportService.updateTicketMetadata(ticketId, body);
    res.status(status.OK).json({
        success: true,
        message: "Ticket updated successfully",
        data: ticket,
    });
};

import { supportEventEmitter } from "../../support/support.events";

/**
 * GET /v1/admin/support/metrics
 */
export const getSupportMetrics = async (_req: Request, res: Response) => {
    const metrics = await adminSupportService.getSupportMetrics();
    res.status(status.OK).json({
        success: true,
        data: metrics,
    });
};

/**
 * GET /v1/admin/support/tickets/:ticketId/stream
 * Admin SSE stream for instant real-time updates
 */
export const streamAdminTicketMessages = async (req: Request, res: Response) => {
    const { ticketId } = req.params;

    try {
        await adminSupportService.getTicketDetail(ticketId);
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

    const heartbeat = setInterval(() => {
        res.write(`:ping\n\n`);
    }, 15000);

    req.on("close", () => {
        clearInterval(heartbeat);
        supportEventEmitter.off(channel, listener);
    });
};
