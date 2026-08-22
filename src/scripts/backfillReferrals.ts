import { referralService } from "../modules/referral/referral.service";
import { logger } from "../config/logger";

async function main() {
    logger.info("Starting referral code backfill for existing users...");
    const result = await referralService.backfillMissingReferralCodes();
    logger.info(`Backfill complete! Generated referral codes for ${result.count} existing user(s).`);
    process.exit(0);
}

main().catch((err) => {
    logger.error("Error running referral backfill:", err);
    process.exit(1);
});
