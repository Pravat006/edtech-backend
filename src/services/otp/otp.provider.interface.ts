export interface OtpVerificationResult {
    success: boolean;
    reason?: string;
    mobile?: string;
}

export interface IOtpProvider {
    name: string;
    sendOtp(phoneNumber: string): Promise<{ status: string; expiresIn?: number }>;
    verifyOtp(phoneNumber: string, tokenOrCode: string): Promise<OtpVerificationResult>;
}
