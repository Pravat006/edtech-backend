import { IEmailProvider } from "./email-provider.interface";
import { BrevoEmailProvider } from "./brevo.provider";
import { ResendEmailProvider } from "./resend.provider";
import { SmtpEmailProvider } from "./smtp.provider";
import { logger } from "@/config/logger";

export class EmailProviderFactory {
    private static instance: IEmailProvider | null = null;

    public static getProvider(): IEmailProvider {
        if (this.instance) {
            return this.instance;
        }

        const providerType = (process.env.EMAIL_PROVIDER || "brevo").toLowerCase().trim();

        switch (providerType) {
            case "resend":
                logger.info("[EmailProviderFactory] Initialized ResendEmailProvider strategy.");
                this.instance = new ResendEmailProvider();
                break;
            case "smtp":
                logger.info("[EmailProviderFactory] Initialized SmtpEmailProvider strategy.");
                this.instance = new SmtpEmailProvider();
                break;
            case "brevo":
            default:
                logger.info("[EmailProviderFactory] Initialized BrevoEmailProvider strategy.");
                this.instance = new BrevoEmailProvider();
                break;
        }

        return this.instance;
    }

    /**
     * Resets singleton instance
     */
    public static resetInstance() {
        this.instance = null;
    }
}
