export interface GuardResult {
    allowed: boolean;
    reason?: string;
}

export class ContentGuardService {
    public checkLocally(message: string): GuardResult {
        const trimmed = message.trim();

        if (!trimmed) {
            return { allowed: false, reason: "Message cannot be empty" };
        }

        if (trimmed.length > 3000) {
            return { allowed: false, reason: "Message exceeds maximum allowed length of 3000 characters" };
        }

        // Basic check for obvious injection patterns
        const lower = trimmed.toLowerCase();
        if (
            lower.includes("ignore all previous instructions") ||
            lower.includes("system prompt reveal") ||
            lower.includes("disregard safety guidelines")
        ) {
            return {
                allowed: false,
                reason: "Your query contains unauthorized system override commands.",
            };
        }

        return { allowed: true };
    }

    public getRejectionMessage(reason?: string): string {
        return reason || "Your query could not be processed due to safety/scope guidelines.";
    }
}

export const contentGuardService = new ContentGuardService();
