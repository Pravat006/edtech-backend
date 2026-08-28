import { IOtpProvider } from "./otp.provider.interface";
import { Msg91OtpProvider } from "./msg91.otp.provider";
import { MockOtpProvider } from "./mock.otp.provider";

export class OtpProviderFactory {
    public static getProvider(): IOtpProvider {
        const providerName = (process.env.OTP_PROVIDER || "mock").toLowerCase();

        if (providerName === "msg91" && process.env.MSG91_AUTH_KEY) {
            return new Msg91OtpProvider();
        }

        // Default to Mock OTP Provider for Phone OTP when MSG91 is unconfigured or in mock mode
        return new MockOtpProvider();
    }
}
