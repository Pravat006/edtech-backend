import { Server as HttpServer } from "http";
import { WebSocketServer, WebSocket } from "ws";
import jwt from "jsonwebtoken";
import { logger } from "@/config/logger";

interface AuthenticatedWebSocket extends WebSocket {
    userId?: string;
    userName?: string;
    isAlive?: boolean;
}

interface ChatMessagePayload {
    event: "chat:send_message";
    payload: {
        recipientId: string;
        threadId: string;
        tempId: string;
        text: string;
        timestamp: string;
    };
}

interface TypingPayload {
    event: "chat:typing";
    payload: {
        recipientId: string;
        threadId: string;
        isTyping: boolean;
    };
}

type IncomingClientMessage = ChatMessagePayload | TypingPayload;

export class ChatWebSocketGateway {
    private wss: WebSocketServer | null = null;
    private userSockets: Map<string, Set<AuthenticatedWebSocket>> = new Map();
    private heartbeatInterval: NodeJS.Timeout | null = null;

    public init(server: HttpServer) {
        this.wss = new WebSocketServer({ server, path: "/ws/chat" });

        logger.info("[ChatWebSocketGateway] Initialized WebSocket gateway at /ws/chat");

        this.wss.on("connection", (ws: AuthenticatedWebSocket, req) => {
            try {
                const url = new URL(req.url || "", `http://${req.headers.host}`);
                const token = url.searchParams.get("token");

                if (!token) {
                    logger.warn("[ChatWebSocketGateway] Connection rejected: No JWT token provided.");
                    ws.close(4001, "Authentication token required");
                    return;
                }

                const jwtSecret = process.env.JWT_SECRET || "default_jwt_secret";
                const decoded = jwt.verify(token, jwtSecret) as { id: string; name?: string };

                if (!decoded || !decoded.id) {
                    logger.warn("[ChatWebSocketGateway] Connection rejected: Invalid JWT token.");
                    ws.close(4002, "Invalid token");
                    return;
                }

                ws.userId = decoded.id;
                ws.userName = decoded.name || "User";
                ws.isAlive = true;

                // Register socket in user map
                if (!this.userSockets.has(ws.userId)) {
                    this.userSockets.set(ws.userId, new Set());
                }
                this.userSockets.get(ws.userId)!.add(ws);

                logger.info(`[ChatWebSocketGateway] Client connected: userId=${ws.userId} (${ws.userName})`);

                // Send connection success acknowledgement
                this.sendToSocket(ws, "chat:connected", {
                    userId: ws.userId,
                    message: "Connected to WebSocket chat gateway",
                });

                // Attach event handlers
                ws.on("pong", () => {
                    ws.isAlive = true;
                });

                ws.on("message", (raw: string | Buffer) => {
                    this.handleIncomingMessage(ws, raw.toString());
                });

                ws.on("close", () => {
                    this.removeSocket(ws);
                });

                ws.on("error", (err) => {
                    logger.error(`[ChatWebSocketGateway] Socket error for userId=${ws.userId}: ${err.message}`);
                    this.removeSocket(ws);
                });
            } catch (err: any) {
                logger.error(`[ChatWebSocketGateway] Auth error during socket connection: ${err?.message || err}`);
                ws.close(4003, "Authentication failed");
            }
        });

        // Start 30s heartbeat ping
        this.heartbeatInterval = setInterval(() => {
            if (!this.wss) return;
            this.wss.clients.forEach((client: WebSocket) => {
                const authWs = client as AuthenticatedWebSocket;
                if (authWs.isAlive === false) {
                    logger.warn(`[ChatWebSocketGateway] Terminating inactive socket for userId=${authWs.userId}`);
                    return authWs.terminate();
                }
                authWs.isAlive = false;
                authWs.ping();
            });
        }, 30000);
    }

    private handleIncomingMessage(senderWs: AuthenticatedWebSocket, rawData: string) {
        if (!senderWs.userId) return;

        try {
            const parsed: IncomingClientMessage = JSON.parse(rawData);

            if (parsed.event === "chat:send_message") {
                const { recipientId, threadId, tempId, text, timestamp } = parsed.payload;

                if (!recipientId || !text || !tempId) {
                    return;
                }

                const msgId = `msg_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
                const deliveredTimestamp = timestamp || new Date().toISOString();

                // 1. Send ACK back to sender
                this.sendToSocket(senderWs, "chat:message_ack", {
                    tempId,
                    id: msgId,
                    threadId,
                    status: "sent",
                    timestamp: deliveredTimestamp,
                });

                // 2. Deliver message to recipient's active socket(s) if online
                const recipientSockets = this.userSockets.get(recipientId);
                let isDelivered = false;

                if (recipientSockets && recipientSockets.size > 0) {
                    recipientSockets.forEach((recWs) => {
                        if (recWs.readyState === WebSocket.OPEN) {
                            this.sendToSocket(recWs, "chat:receive_message", {
                                id: msgId,
                                threadId,
                                senderId: senderWs.userId,
                                senderName: senderWs.userName,
                                text,
                                timestamp: deliveredTimestamp,
                            });
                            isDelivered = true;
                        }
                    });
                }

                // If delivered, send 'delivered' ACK update to sender
                if (isDelivered) {
                    this.sendToSocket(senderWs, "chat:message_ack", {
                        tempId,
                        id: msgId,
                        threadId,
                        status: "delivered",
                        timestamp: deliveredTimestamp,
                    });
                }
            } else if (parsed.event === "chat:typing") {
                const { recipientId, threadId, isTyping } = parsed.payload;
                const recipientSockets = this.userSockets.get(recipientId);
                if (recipientSockets) {
                    recipientSockets.forEach((recWs) => {
                        if (recWs.readyState === WebSocket.OPEN) {
                            this.sendToSocket(recWs, "chat:typing", {
                                threadId,
                                senderId: senderWs.userId,
                                isTyping,
                            });
                        }
                    });
                }
            }
        } catch (err: any) {
            logger.error(`[ChatWebSocketGateway] Error processing message: ${err?.message || err}`);
        }
    }

    private sendToSocket(ws: AuthenticatedWebSocket, event: string, payload: any) {
        if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ event, payload }));
        }
    }

    private removeSocket(ws: AuthenticatedWebSocket) {
        if (ws.userId && this.userSockets.has(ws.userId)) {
            const set = this.userSockets.get(ws.userId)!;
            set.delete(ws);
            if (set.size === 0) {
                this.userSockets.delete(ws.userId);
            }
            logger.info(`[ChatWebSocketGateway] Client disconnected: userId=${ws.userId}`);
        }
    }

    public getOnlineUserIds(): Set<string> {
        return new Set(this.userSockets.keys());
    }

    public isUserOnline(userId: string): boolean {
        return this.userSockets.has(userId) && (this.userSockets.get(userId)?.size || 0) > 0;
    }

    public close() {
        if (this.heartbeatInterval) clearInterval(this.heartbeatInterval);
        if (this.wss) this.wss.close();
    }
}

export const chatGateway = new ChatWebSocketGateway();
