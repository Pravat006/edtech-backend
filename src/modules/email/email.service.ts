import { EmailProviderFactory } from "./providers/email-provider.factory";
import {
    renderSubAdminInviteTemplate,
    renderDocumentVerificationTemplate,
    renderPasswordResetTemplate,
    renderEmailVerificationOtpTemplate,
} from "./templates/email-templates";
import { logger } from "@/config/logger";

export class EmailService {
    /**
     * Send Sub-Admin activation invitation email
     */
    public async sendSubAdminInvite(params: {
        to: string;
        name: string;
        acceptUrl: string;
        permissions: string[];
    }): Promise<boolean> {
        try {
            const provider = EmailProviderFactory.getProvider();
            const { html, text } = renderSubAdminInviteTemplate({
                name: params.name,
                acceptUrl: params.acceptUrl,
                permissions: params.permissions,
            });

            const result = await provider.sendEmail({
                to: params.to,
                subject: "Invitation: Set Up Your Sub-Admin Account - Vie Brain",
                html,
                text,
            });

            if (result.success) {
                logger.info(`[EmailService] Sent sub-admin invite email to ${params.to} via [${result.provider}] (MessageId: ${result.messageId})`);
            } else {
                logger.warn(`[EmailService] Failed sending sub-admin invite to ${params.to} via [${result.provider}]: ${result.error}`);
            }

            return result.success;
        } catch (err: any) {
            logger.error(`[EmailService] Exception in sendSubAdminInvite: ${err?.message || err}`);
            return false;
        }
    }

    /**
     * Send document verification update notice (Approval or Rejection)
     */
    public async sendDocumentVerificationNotice(params: {
        to: string;
        studentName: string;
        documentType: string;
        status: "APPROVED" | "REJECTED";
        reason?: string;
    }): Promise<boolean> {
        try {
            const provider = EmailProviderFactory.getProvider();
            const { html, text } = renderDocumentVerificationTemplate({
                studentName: params.studentName,
                documentType: params.documentType,
                status: params.status,
                reason: params.reason,
            });

            const subject = params.status === "APPROVED"
                ? `[Approved] Your ${params.documentType} has been verified`
                : `[Action Required] Update regarding your ${params.documentType} submission`;

            const result = await provider.sendEmail({
                to: params.to,
                subject,
                html,
                text,
            });

            return result.success;
        } catch (err: any) {
            logger.error(`[EmailService] Exception in sendDocumentVerificationNotice: ${err?.message || err}`);
            return false;
        }
    }

    /**
     * Send password reset request email
     */
    public async sendPasswordResetEmail(params: {
        to: string;
        name: string;
        resetUrl: string;
    }): Promise<boolean> {
        try {
            const provider = EmailProviderFactory.getProvider();
            const { html, text } = renderPasswordResetTemplate({
                name: params.name,
                resetUrl: params.resetUrl,
            });

            const result = await provider.sendEmail({
                to: params.to,
                subject: "Reset Your Account Password - Vie Brain",
                html,
                text,
            });

            return result.success;
        } catch (err: any) {
            logger.error(`[EmailService] Exception in sendPasswordResetEmail: ${err?.message || err}`);
            return false;
        }
    }

    /**
     * Send email verification OTP
     */
    public async sendEmailVerificationOtp(params: {
        to: string;
        name: string;
        otpCode: string;
    }): Promise<boolean> {
        try {
            const provider = EmailProviderFactory.getProvider();
            const { html, text } = renderEmailVerificationOtpTemplate({
                name: params.name,
                otpCode: params.otpCode,
            });

            const result = await provider.sendEmail({
                to: params.to,
                subject: `${params.otpCode} is your Vie Brain Email Verification Code`,
                html,
                text,
            });

            return result.success;
        } catch (err: any) {
            logger.error(`[EmailService] Exception in sendEmailVerificationOtp: ${err?.message || err}`);
            return false;
        }
    }
}

export const emailService = new EmailService();

