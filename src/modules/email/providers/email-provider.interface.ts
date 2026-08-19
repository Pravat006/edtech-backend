export interface SendEmailOptions {
    to: string | string[];
    subject: string;
    html: string;
    text?: string;
    fromName?: string;
    fromEmail?: string;
    replyTo?: string;
}

export interface EmailSendResult {
    success: boolean;
    messageId?: string;
    provider: string;
    error?: string;
}

export interface IEmailProvider {
    readonly name: string;
    sendEmail(options: SendEmailOptions): Promise<EmailSendResult>;
}
