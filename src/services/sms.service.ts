import { OtpProviderFactory } from "./otp/otp.factory";

class SmsService {
    public async sendOtp(phoneNumber: string) {
        const provider = OtpProviderFactory.getProvider();
        return await provider.sendOtp(phoneNumber);
    }

    public async verifyOtp(phoneNumber: string, tokenOrCode: string) {
        const provider = OtpProviderFactory.getProvider();
        return await provider.verifyOtp(phoneNumber, tokenOrCode);
    }
}

export const smsService = new SmsService();