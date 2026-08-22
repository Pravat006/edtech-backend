import app from "./app";
import { logger } from "./config/logger";
import { referralService } from "./modules/referral/referral.service";

const PORT = process.env.PORT || 3000;

app.listen(Number(PORT), "0.0.0.0", () => {
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
});

