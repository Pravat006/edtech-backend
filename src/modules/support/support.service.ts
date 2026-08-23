import { db } from "@/config/database";
import { APIError } from "@/utils/APIError";
import status from "http-status";
import { TicketCategory, TicketPriority, TicketStatus, TicketSenderType } from "../../../generated/prisma";
import { emitNewMessage } from "./support.events";

export interface CreateTicketDTO {
    subject: string;
    category?: TicketCategory;
    priority?: TicketPriority;
    message: string;
    attachmentMediaIds?: string[];
}

export interface AddMessageDTO {
    message: string;
    attachmentMediaIds?: string[];
}

/**
 * Generate a unique, readable ticket number like #SUP-1082
 */
async function generateTicketNumber(): Promise<string> {
    const count = await db.supportTicket.count();
    const nextNum = 1001 + count;
    return `SUP-${nextNum}`;
}

export class SupportService {
    /**
     * Create a new support ticket raised by a user
     */
    public async createTicket(userId: string, data: CreateTicketDTO) {
        const ticketNumber = await generateTicketNumber();

        return await db.$transaction(async (tx) => {
            const ticket = await tx.supportTicket.create({
                data: {
                    ticketNumber,
                    userId,
                    subject: data.subject.trim(),
                    category: data.category || TicketCategory.OTHER,
                    priority: data.priority || TicketPriority.MEDIUM,
                    status: TicketStatus.OPEN,
                    lastRepliedAt: new Date(),
                },
            });

            // Attach initial problem message
            await tx.supportMessage.create({
                data: {
                    ticketId: ticket.id,
                    senderType: TicketSenderType.USER,
                    senderUserId: userId,
                    message: data.message.trim(),
                    attachments: data.attachmentMediaIds?.length
                        ? { connect: data.attachmentMediaIds.map((id) => ({ id })) }
                        : undefined,
                },
            });

            return ticket;
        });
    }

    /**
     * Fetch all support tickets raised by a user
     */
    public async getUserTickets(
        userId: string,
        query: { status?: TicketStatus; page?: number; limit?: number }
    ) {
        const page = Math.max(1, query.page || 1);
        const limit = Math.min(50, Math.max(1, query.limit || 10));
        const skip = (page - 1) * limit;

        const where: any = { userId };
        if (query.status) {
            where.status = query.status;
        }

        const [total, items] = await Promise.all([
            db.supportTicket.count({ where }),
            db.supportTicket.findMany({
                where,
                orderBy: { updatedAt: "desc" },
                skip,
                take: limit,
                select: {
                    id: true,
                    ticketNumber: true,
                    subject: true,
                    category: true,
                    priority: true,
                    status: true,
                    lastRepliedAt: true,
                    createdAt: true,
                    updatedAt: true,
                    messages: {
                        take: 1,
                        orderBy: { createdAt: "desc" },
                        select: {
                            message: true,
                            senderType: true,
                            createdAt: true,
                        },
                    },
                },
            }),
        ]);

        return {
            items,
            pagination: {
                total,
                page,
                limit,
                totalPages: Math.ceil(total / limit),
            },
        };
    }

    /**
     * Get detailed conversation thread of a ticket owned by the user
     */
    public async getTicketDetail(userId: string, ticketId: string) {
        const ticket = await db.supportTicket.findFirst({
            where: { id: ticketId, userId },
            include: {
                assignedAdmin: {
                    select: {
                        id: true,
                        name: true,
                        email: true,
                    },
                },
                messages: {
                    where: { isInternalNote: false }, // Hide internal admin notes from user
                    orderBy: { createdAt: "asc" },
                    include: {
                        senderUser: {
                            select: { id: true, name: true, phoneNumber: true },
                        },
                        senderAdmin: {
                            select: { id: true, name: true },
                        },
                        attachments: {
                            select: { id: true, url: true, type: true, mimeType: true },
                        },
                    },
                },
            },
        });

        if (!ticket) {
            throw new APIError(status.NOT_FOUND, "Support ticket not found");
        }

        return ticket;
    }

    /**
     * User posts a reply message to an open ticket
     */
    public async addMessage(userId: string, ticketId: string, data: AddMessageDTO) {
        const ticket = await db.supportTicket.findFirst({
            where: { id: ticketId, userId },
        });

        if (!ticket) {
            throw new APIError(status.NOT_FOUND, "Support ticket not found");
        }

        if (ticket.status === TicketStatus.CLOSED) {
            throw new APIError(status.BAD_REQUEST, "Cannot reply to a closed ticket. Please open a new ticket.");
        }

        return await db.$transaction(async (tx) => {
            const message = await tx.supportMessage.create({
                data: {
                    ticketId,
                    senderType: TicketSenderType.USER,
                    senderUserId: userId,
                    message: data.message.trim(),
                    attachments: data.attachmentMediaIds?.length
                        ? { connect: data.attachmentMediaIds.map((id) => ({ id })) }
                        : undefined,
                },
                include: {
                    senderUser: {
                        select: { id: true, name: true, phoneNumber: true },
                    },
                    attachments: true,
                },
            });

            // Update ticket status to OPEN and update lastRepliedAt
            await tx.supportTicket.update({
                where: { id: ticketId },
                data: {
                    status: TicketStatus.OPEN,
                    lastRepliedAt: new Date(),
                },
            });

            emitNewMessage(ticketId, message);

            return message;
        });
    }

    /**
     * User marks ticket as resolved or closed
     */
    public async closeTicket(userId: string, ticketId: string) {
        const ticket = await db.supportTicket.findFirst({
            where: { id: ticketId, userId },
        });

        if (!ticket) {
            throw new APIError(status.NOT_FOUND, "Support ticket not found");
        }

        return await db.supportTicket.update({
            where: { id: ticketId },
            data: {
                status: TicketStatus.RESOLVED,
            },
        });
    }
}

export const supportService = new SupportService();
