import axios from "axios";
import { logger } from "@/config/logger";

export interface PushNotificationPayload {
    to: string; // ExpoPushToken[xxxx]
    title: string;
    body: string;
    data?: Record<string, any>;
    sound?: "default" | null;
    badge?: number;
}

const EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send";

export class PushNotificationService {
    /**
     * Send Expo Push Notification to a single user token
     */
    public async sendPushNotification(payload: PushNotificationPayload): Promise<boolean> {
        if (!payload.to || !payload.to.startsWith("ExponentPushToken")) {
            logger.warn(`[PushNotificationService] Invalid push token: ${payload.to}`);
            return false;
        }

        try {
            const response = await axios.post(
                EXPO_PUSH_URL,
                {
                    to: payload.to,
                    title: payload.title,
                    body: payload.body,
                    data: payload.data || {},
                    sound: payload.sound || "default",
                    badge: payload.badge || 1,
                },
                {
                    headers: {
                        Accept: "application/json",
                        "Accept-encoding": "gzip, deflate",
                        "Content-Type": "application/json",
                    },
                }
            );

            logger.info(`[PushNotificationService] Sent notification to ${payload.to}: ${response.status}`);
            return true;
        } catch (error: any) {
            logger.error(`[PushNotificationService] Failed to send push notification: ${error.message}`);
            return false;
        }
    }
}

export const pushNotificationService = new PushNotificationService();
