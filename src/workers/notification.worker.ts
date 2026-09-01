import { Worker, Job } from "bullmq";
import { bullMqConnectionOptions } from "@/config/redis";
import { logger } from "@/config/logger";
import { db } from "@/config/database";
import { Expo, ExpoPushMessage } from "expo-server-sdk";
import { NOTIFICATION_QUEUE_NAME, SendPushJobData } from "./notification.queue";

// Create a new Expo SDK client
// optionally providing an access token if you have enabled push security
const expo = new Expo();

export const notificationWorker = new Worker(
    NOTIFICATION_QUEUE_NAME,
    async (job: Job) => {
        logger.info(`[NotificationWorker] Processing job ${job.name} (ID: ${job.id})`);

        switch (job.name) {
            case "send-push":
                await handleSendPush(job.data as SendPushJobData);
                break;
            case "send-push-batch":
                await handleSendPushBatch(job.data as SendPushJobData);
                break;
            case "schedule-drip-content":
                await handleDripContentCron();
                break;
            case "schedule-inactivity":
                await handleInactivityCron();
                break;
            default:
                logger.warn(`[NotificationWorker] Unknown job name: ${job.name}`);
        }
    },
    {
        connection: bullMqConnectionOptions as any,
        concurrency: 5, // Process 5 jobs concurrently
    }
);

notificationWorker.on("completed", (job) => {
    logger.info(`[NotificationWorker] Job ${job.id} completed successfully`);
});

notificationWorker.on("failed", (job, err) => {
    logger.error(`[NotificationWorker] Job ${job?.id} failed with error:`, err);
});

// --- Job Handlers ---

async function handleSendPush(data: SendPushJobData) {
    if (!data.userId) return;

    const user = await db.user.findUnique({
        where: { id: data.userId },
        select: { expoPushToken: true },
    });

    if (!user || !user.expoPushToken) {
        logger.info(`[NotificationWorker] User ${data.userId} has no expoPushToken. Skipping.`);
        return;
    }

    if (!Expo.isExpoPushToken(user.expoPushToken)) {
        logger.error(`[NotificationWorker] Push token ${user.expoPushToken} is not a valid Expo push token`);
        return;
    }

    const messages: ExpoPushMessage[] = [{
        to: user.expoPushToken,
        sound: 'default',
        title: data.title,
        body: data.body,
        data: data.data || {},
    }];

    await sendExpoMessages(messages);
}

async function handleSendPushBatch(data: SendPushJobData) {
    if (!data.userIds || data.userIds.length === 0) return;

    const users = await db.user.findMany({
        where: { 
            id: { in: data.userIds },
            expoPushToken: { not: null }
        },
        select: { expoPushToken: true },
    });

    const messages: ExpoPushMessage[] = [];
    for (const user of users) {
        if (user.expoPushToken && Expo.isExpoPushToken(user.expoPushToken)) {
            messages.push({
                to: user.expoPushToken,
                sound: 'default',
                title: data.title,
                body: data.body,
                data: data.data || {},
            });
        }
    }

    await sendExpoMessages(messages);
}

// --- Cron Job Handlers ---

async function handleDripContentCron() {
    // 1. Find all courses, modules, lessons scheduled for TODAY
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);
    
    const tomorrow = new Date(today);
    tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);

    const dateQuery = {
        scheduledPublishDate: {
            gte: today,
            lt: tomorrow,
        }
    };

    const lessons = await db.lesson.findMany({
        where: dateQuery,
        include: { module: { include: { course: true } } },
    });

    for (const lesson of lessons) {
        // Find enrolled users for this course
        const enrollments = await db.enrollment.findMany({
            where: { courseId: lesson.module.courseId, status: "ACTIVE" },
            select: { userId: true },
        });
        
        const userIds = enrollments.map(e => e.userId);
        if (userIds.length > 0) {
            await handleSendPushBatch({
                userIds,
                title: "New Lesson Unlocked! 🔓",
                body: `"${lesson.title}" is now available in ${lesson.module.course.title}. Start learning now!`,
                data: { courseId: lesson.module.courseId, lessonId: lesson.id }
            });
        }
    }
}

async function handleInactivityCron() {
    const threeDaysAgo = new Date();
    threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);

    // Find in-progress lessons where updatedAt is older than 3 days
    const inactiveProgress = await db.lessonProgress.findMany({
        where: {
            status: "IN_PROGRESS",
            updatedAt: { lte: threeDaysAgo },
            user: { expoPushToken: { not: null } }
        },
        include: {
            lesson: { include: { module: { include: { course: true } } } },
        },
    });

    for (const progress of inactiveProgress) {
        await handleSendPush({
            userId: progress.userId,
            title: "We miss you! 📚",
            body: `You are so close to finishing ${progress.lesson.module.course.title}. Pick up right where you left off!`,
            data: { courseId: progress.lesson.module.courseId, lessonId: progress.lessonId }
        });
    }
}

// --- Helper: Chunk and Send ---
async function sendExpoMessages(messages: ExpoPushMessage[]) {
    if (messages.length === 0) return;

    // The Expo push service accepts batches of notifications so
    // that you don't need to send 1000 requests to send 1000 notifications.
    const chunks = expo.chunkPushNotifications(messages);
    
    for (const chunk of chunks) {
        try {
            const ticketChunk = await expo.sendPushNotificationsAsync(chunk);
            logger.info(`[NotificationWorker] Sent chunk of ${chunk.length} notifications. Receipts:`, ticketChunk);
        } catch (error) {
            logger.error('[NotificationWorker] Error sending push chunk', error);
        }
    }
}
