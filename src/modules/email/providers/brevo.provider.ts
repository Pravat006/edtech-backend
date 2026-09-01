import { IEmailProvider, SendEmailOptions, EmailSendResult } from "./email-provider.interface";
import { logger } from "@/config/logger";

export class BrevoEmailProvider implements IEmailProvider {
    public readonly name = "brevo";
    private apiKey: string;
    private defaultFromEmail: string;
    private defaultFromName: string;

    constructor(apiKey?: string, defaultFromEmail?: string, defaultFromName?: string) {
        this.apiKey = apiKey || process.env.BREVO_API_KEY || "";
        this.defaultFromEmail = defaultFromEmail || process.env.EMAIL_FROM_ADDRESS || "noreply@supermind.com";
        this.defaultFromName = defaultFromName || process.env.EMAIL_FROM_NAME || "Vie Brain";
    }

    public async sendEmail(options: SendEmailOptions): Promise<EmailSendResult> {
        if (!this.apiKey) {
            logger.error("[BrevoEmailProvider] BREVO_API_KEY is missing in environment variables.");
            return {
                success: false,
                provider: this.name,
                error: "Brevo API key is not configured.",
            };
        }

        const toList = Array.isArray(options.to)
            ? options.to.map(email => ({ email }))
            : [{ email: options.to }];

        const payload = {
            sender: {
                name: options.fromName || this.defaultFromName,
                email: options.fromEmail || this.defaultFromEmail,
            },
            to: toList,
            subject: options.subject,
            htmlContent: options.html,
            textContent: options.text || undefined,
            replyTo: options.replyTo ? { email: options.replyTo } : undefined,
        };

        try {
            const response = await fetch("https://api.brevo.com/v3/smtp/email", {
                method: "POST",
                headers: {
                    "accept": "application/json",
                    "content-type": "application/json",
                    "api-key": this.apiKey,
                },
                body: JSON.stringify(payload),
            });

            const data = (await response.json().catch(() => ({}))) as Record<string, any>;

            if (!response.ok) {
                const errMsg = data?.message || `Brevo API returned status ${response.status}`;
                logger.error(`[BrevoEmailProvider] Error sending email: ${errMsg}`);
                return {
                    success: false,
                    provider: this.name,
                    error: errMsg,
                };
            }

            return {
                success: true,
                messageId: data.messageId || `brevo-${Date.now()}`,
                provider: this.name,
            };
        } catch (err: any) {
            const errMsg = err?.message || String(err);
            logger.error(`[BrevoEmailProvider] Network error: ${errMsg}`);
            return {
                success: false,
                provider: this.name,
                error: errMsg,
            };
        }
    }
}
