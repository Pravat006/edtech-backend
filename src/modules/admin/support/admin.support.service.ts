import { db } from "@/config/database";
import { APIError } from "@/utils/APIError";
import status from "http-status";
import { TicketCategory, TicketPriority, TicketStatus, TicketSenderType } from "../../../../generated/prisma";
import { emitNewMessage } from "../../support/support.events";
import { pushNotificationService } from "@/services/push-notification.service";

export interface AdminQueryTicketsDTO {
    status?: TicketStatus;
    priority?: TicketPriority;
    category?: TicketCategory;
    assignedAdminId?: string;
    search?: string;
    page?: number;
    limit?: number;
}

export interface AdminReplyDTO {
    message: string;
    isInternalNote?: boolean;
    attachmentMediaIds?: string[];
}

export class AdminSupportService {
    /**
     * Get paginated & searchable list of all support tickets for Admin Dashboard
     */
    public async getAllTickets(query: AdminQueryTicketsDTO) {
        const page = Math.max(1, query.page || 1);
        const limit = Math.min(100, Math.max(1, query.limit || 15));
        const skip = (page - 1) * limit;

        const where: any = {};

        if (query.status) where.status = query.status;
        if (query.priority) where.priority = query.priority;
        if (query.category) where.category = query.category;
        if (query.assignedAdminId) where.assignedAdminId = query.assignedAdminId;

        if (query.search?.trim()) {
            const searchTerm = query.search.trim();
            where.OR = [
                { ticketNumber: { contains: searchTerm, mode: "insensitive" } },
                { subject: { contains: searchTerm, mode: "insensitive" } },
                { user: { name: { contains: searchTerm, mode: "insensitive" } } },
                { user: { email: { contains: searchTerm, mode: "insensitive" } } },
                { user: { phoneNumber: { contains: searchTerm, mode: "insensitive" } } },
            ];
        }

        const [total, items] = await Promise.all([
            db.supportTicket.count({ where }),
            db.supportTicket.findMany({
                where,
                orderBy: [
                    { priority: "desc" },
                    { lastRepliedAt: "desc" },
                ],
                skip,
                take: limit,
                include: {
                    user: {
                        select: {
                            id: true,
                            name: true,
                            email: true,
                            phoneNumber: true,
                        },
                    },
                    assignedAdmin: {
                        select: {
                            id: true,
                            name: true,
                            email: true,
                        },
                    },
                    messages: {
                        take: 1,
                        orderBy: { createdAt: "desc" },
                        select: {
                            message: true,
                            senderType: true,
                            isInternalNote: true,
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
     * Get single ticket full inspection view for Admin (includes user profile, course access, full messages history)
     */
    public async getTicketDetail(ticketId: string) {
        const ticket = await db.supportTicket.findUnique({
            where: { id: ticketId },
            include: {
                user: {
                    select: {
                        id: true,
                        name: true,
                        email: true,
                        phoneNumber: true,
                        createdAt: true,
                        enrollments: {
                            select: {
                                id: true,
                                status: true,
                                enrolledAt: true,
                                course: {
                                    select: { id: true, title: true, price: true },
                                },
                            },
                        },
                    },
                },
                assignedAdmin: {
                    select: { id: true, name: true, email: true },
                },
                messages: {
                    orderBy: { createdAt: "asc" },
                    include: {
                        senderUser: {
                            select: { id: true, name: true, phoneNumber: true },
                        },
                        senderAdmin: {
                            select: { id: true, name: true, email: true },
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
     * Admin posts a reply (or internal note) to a ticket
     */
    public async addAdminReply(adminId: string, ticketId: string, data: AdminReplyDTO) {
        const ticket = await db.supportTicket.findUnique({
            where: { id: ticketId },
            include: {
                user: { select: { id: true, name: true, expoPushToken: true } },
            },
        });

        if (!ticket) {
            throw new APIError(status.NOT_FOUND, "Support ticket not found");
        }

        const isInternalNote = Boolean(data.isInternalNote);

        const result = await db.$transaction(async (tx) => {
            const message = await tx.supportMessage.create({
                data: {
                    ticketId,
                    senderType: TicketSenderType.ADMIN,
                    senderAdminId: adminId,
                    message: data.message.trim(),
                    isInternalNote,
                    attachments: data.attachmentMediaIds?.length
                        ? { connect: data.attachmentMediaIds.map((id) => ({ id })) }
                        : undefined,
                },
                include: {
                    senderAdmin: { select: { id: true, name: true } },
                    attachments: true,
                },
            });

            // If it's a public reply (not an internal note), set status to WAITING_USER
            if (!isInternalNote) {
                await tx.supportTicket.update({
                    where: { id: ticketId },
                    data: {
                        status: TicketStatus.WAITING_USER,
                        lastRepliedAt: new Date(),
                        // Auto-assign to replying admin if currently unassigned
                        assignedAdminId: ticket.assignedAdminId || adminId,
                    },
                });
            }

            emitNewMessage(ticketId, message);

            return message;
        });

        // Send Push Notification if user has a registered token and it's a public reply
        if (!isInternalNote && ticket.user.expoPushToken) {
            pushNotificationService.sendPushNotification({
                to: ticket.user.expoPushToken,
                title: `Support Reply: #${ticket.ticketNumber}`,
                body: data.message.length > 100 ? `${data.message.slice(0, 97)}...` : data.message,
                data: {
                    type: "SUPPORT_TICKET_REPLY",
                    ticketId: ticket.id,
                    ticketNumber: ticket.ticketNumber,
                },
            });
        }

        return result;
    }

    /**
     * Update ticket metadata (Status, Priority, Assignee)
     */
    public async updateTicketMetadata(
        ticketId: string,
        data: {
            status?: TicketStatus;
            priority?: TicketPriority;
            assignedAdminId?: string | null;
        }
    ) {
        const ticket = await db.supportTicket.findUnique({
            where: { id: ticketId },
        });

        if (!ticket) {
            throw new APIError(status.NOT_FOUND, "Support ticket not found");
        }

        return await db.supportTicket.update({
            where: { id: ticketId },
            data: {
                ...(data.status && { status: data.status }),
                ...(data.priority && { priority: data.priority }),
                ...(data.assignedAdminId !== undefined && { assignedAdminId: data.assignedAdminId }),
            },
            include: {
                assignedAdmin: { select: { id: true, name: true, email: true } },
            },
        });
    }

    /**
     * Admin Dashboard Support Analytics Metrics
     */
    public async getSupportMetrics() {
        const [openCount, inProgressCount, waitingUserCount, resolvedTodayCount, urgentCount, categoryBreakdown] =
            await Promise.all([
                db.supportTicket.count({ where: { status: TicketStatus.OPEN } }),
                db.supportTicket.count({ where: { status: TicketStatus.IN_PROGRESS } }),
                db.supportTicket.count({ where: { status: TicketStatus.WAITING_USER } }),
                db.supportTicket.count({
                    where: {
                        status: TicketStatus.RESOLVED,
                        updatedAt: { gte: new Date(new Date().setHours(0, 0, 0, 0)) },
                    },
                }),
                db.supportTicket.count({
                    where: { priority: TicketPriority.URGENT, status: { not: TicketStatus.RESOLVED } },
                }),
                db.supportTicket.groupBy({
                    by: ["category"],
                    _count: { id: true },
                }),
            ]);

        return {
            counts: {
                open: openCount,
                inProgress: inProgressCount,
                waitingUser: waitingUserCount,
                resolvedToday: resolvedTodayCount,
                urgent: urgentCount,
            },
            categoryBreakdown: categoryBreakdown.map((item) => ({
                category: item.category,
                count: item._count.id,
            })),
        };
    }
}

export const adminSupportService = new AdminSupportService();
