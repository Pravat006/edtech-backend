import http from "http";
import app from "./app";
import { logger } from "./config/logger";
import { referralService } from "./modules/referral/referral.service";
import { chatGateway } from "./websocket/chat.gateway";
import { seedDefaultCmsPages } from "./modules/content/cms.seeder";
import { NotificationQueueService } from "./workers/notification.queue";
import "./workers/notification.worker"; // Import to initialize and start the BullMQ worker

const PORT = process.env.PORT || 3000;
const server = http.createServer(app);

// Initialize WebSocket Chat Gateway
chatGateway.init(server);

server.listen(Number(PORT), "0.0.0.0", () => {
    logger.info(`[SERVER] backend is live on http://0.0.0.0:${PORT}`);
    
    // Automatically backfill referral codes for old users on server start
    referralService.backfillMissingReferralCodes()
        .then((res) => {
            if (res.count > 0) {
                logger.info(`[REFERRAL_BACKFILL] Generated referral codes for ${res.count} existing user(s).`);
            }
        })
        .catch((err) => {
            logger.error("[REFERRAL_BACKFILL] Failed to backfill referral codes:", err);
        });

    // Idempotently seed missing CMS static pages on deployment / boot
    seedDefaultCmsPages().catch((err) => {
        logger.error("[CMS_SEEDER] Failed to seed default static pages:", err);
    });

    // Initialize BullMQ Scheduled Cron Jobs for Push Notifications
    NotificationQueueService.scheduleDripContentJob().catch(err => logger.error("Failed to schedule drip content cron:", err));
    NotificationQueueService.scheduleInactivityReminderJob().catch(err => logger.error("Failed to schedule inactivity cron:", err));
});

