import { Queue } from "bullmq";
import { bullMqConnectionOptions } from "@/config/redis";
import { logger } from "@/config/logger";

export const NOTIFICATION_QUEUE_NAME = "lms-notification-queue";

export const notificationQueue = new Queue(NOTIFICATION_QUEUE_NAME, {
    connection: bullMqConnectionOptions as any,
});

export interface SendPushJobData {
    userId?: string; // If provided, send to specific user
    userIds?: string[]; // If provided, send to multiple users
    title: string;
    body: string;
    data?: Record<string, any>;
}

export class NotificationQueueService {
    static async sendPushToUser(userId: string, title: string, body: string, data?: Record<string, any>) {
        await notificationQueue.add(
            "send-push",
            { userId, title, body, data },
            { attempts: 3, backoff: { type: "exponential", delay: 2000 } }
        );
        logger.info(`[NotificationQueue] Queued push notification for user: ${userId}`);
    }

    static async sendPushToUsers(userIds: string[], title: string, body: string, data?: Record<string, any>) {
        if (userIds.length === 0) return;
        await notificationQueue.add(
            "send-push-batch",
            { userIds, title, body, data },
            { attempts: 3, backoff: { type: "exponential", delay: 2000 } }
        );
        logger.info(`[NotificationQueue] Queued push notification for ${userIds.length} users`);
    }

    static async scheduleDripContentJob() {
        // Run every day at 00:00 UTC
        await notificationQueue.upsertJobScheduler(
            "daily-drip-content-job",
            { pattern: "0 0 * * *", tz: "UTC" },
            { name: "schedule-drip-content", data: {} }
        );
        logger.info("[NotificationQueue] Scheduled daily drip content cron job");
    }

    static async scheduleInactivityReminderJob() {
        // Run every day at 12:00 UTC
        await notificationQueue.upsertJobScheduler(
            "daily-inactivity-job",
            { pattern: "0 12 * * *", tz: "UTC" },
            { name: "schedule-inactivity", data: {} }
        );
        logger.info("[NotificationQueue] Scheduled daily inactivity cron job");
    }
}
