import { IEmailProvider, SendEmailOptions, EmailSendResult } from "./email-provider.interface";
import { logger } from "@/config/logger";

export class ResendEmailProvider implements IEmailProvider {
    public readonly name = "resend";
    private apiKey: string;
    private defaultFromEmail: string;
    private defaultFromName: string;

    constructor(apiKey?: string, defaultFromEmail?: string, defaultFromName?: string) {
        this.apiKey = apiKey || process.env.RESEND_API_KEY || "";
        this.defaultFromEmail = defaultFromEmail || process.env.EMAIL_FROM_ADDRESS || "onboarding@resend.dev";
        this.defaultFromName = defaultFromName || process.env.EMAIL_FROM_NAME || "Vie Brain";
    }

    public async sendEmail(options: SendEmailOptions): Promise<EmailSendResult> {
        if (!this.apiKey) {
            logger.error("[ResendEmailProvider] RESEND_API_KEY is missing in environment variables.");
            return {
                success: false,
                provider: this.name,
                error: "Resend API key is not configured.",
            };
        }

        const toList = Array.isArray(options.to) ? options.to : [options.to];
        const fromName = options.fromName || this.defaultFromName;
        const fromEmail = options.fromEmail || this.defaultFromEmail;

        const payload = {
            from: `${fromName} <${fromEmail}>`,
            to: toList,
            subject: options.subject,
            html: options.html,
            text: options.text || undefined,
            reply_to: options.replyTo || undefined,
        };

        try {
            const response = await fetch("https://api.resend.com/emails", {
                method: "POST",
                headers: {
                    "Authorization": `Bearer ${this.apiKey}`,
                    "Content-Type": "application/json",
                },
                body: JSON.stringify(payload),
            });

            const data = (await response.json().catch(() => ({}))) as Record<string, any>;

            if (!response.ok) {
                const errMsg = data?.message || `Resend API returned status ${response.status}`;
                logger.error(`[ResendEmailProvider] Error sending email: ${errMsg}`);
                return {
                    success: false,
                    provider: this.name,
                    error: errMsg,
                };
            }

            return {
                success: true,
                messageId: data.id || `resend-${Date.now()}`,
                provider: this.name,
            };
        } catch (err: any) {
            const errMsg = err?.message || String(err);
            logger.error(`[ResendEmailProvider] Network error: ${errMsg}`);
            return {
                success: false,
                provider: this.name,
                error: errMsg,
            };
        }
    }
}
