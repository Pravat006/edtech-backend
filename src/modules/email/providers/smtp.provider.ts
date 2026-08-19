import { IEmailProvider, SendEmailOptions, EmailSendResult } from "./email-provider.interface";
import nodemailer from "nodemailer";
import { logger } from "@/config/logger";

export class SmtpEmailProvider implements IEmailProvider {
    public readonly name = "smtp";
    private transporter: nodemailer.Transporter | null = null;
    private defaultFromEmail: string;
    private defaultFromName: string;

    constructor() {
        const host = process.env.SMTP_HOST;
        const port = Number(process.env.SMTP_PORT) || 587;
        const user = process.env.SMTP_USER;
        const pass = process.env.SMTP_PASS || process.env.SMTP_PASSWORD;

        this.defaultFromEmail = process.env.EMAIL_FROM_ADDRESS || "noreply@helloworldeducation.com";
        this.defaultFromName = process.env.EMAIL_FROM_NAME || "Hello World Education";

        if (host && user && pass) {
            this.transporter = nodemailer.createTransport({
                host,
                port,
                secure: port === 465,
                auth: { user, pass },
            });
        }
    }

    public async sendEmail(options: SendEmailOptions): Promise<EmailSendResult> {
        if (!this.transporter) {
            logger.error("[SmtpEmailProvider] SMTP credentials (SMTP_HOST, SMTP_USER, SMTP_PASS) missing.");
            return {
                success: false,
                provider: this.name,
                error: "SMTP transporter is not configured.",
            };
        }

        const fromName = options.fromName || this.defaultFromName;
        const fromEmail = options.fromEmail || this.defaultFromEmail;

        try {
            const info = await this.transporter.sendMail({
                from: `"${fromName}" <${fromEmail}>`,
                to: Array.isArray(options.to) ? options.to.join(", ") : options.to,
                subject: options.subject,
                html: options.html,
                text: options.text,
                replyTo: options.replyTo,
            });

            return {
                success: true,
                messageId: info.messageId || `smtp-${Date.now()}`,
                provider: this.name,
            };
        } catch (err: any) {
            const errMsg = err?.message || String(err);
            logger.error(`[SmtpEmailProvider] SMTP error: ${errMsg}`);
            return {
                success: false,
                provider: this.name,
                error: errMsg,
            };
        }
    }
}
