import { IOtpProvider } from "./otp.provider.interface";
import { Msg91OtpProvider } from "./msg91.otp.provider";
import { MockOtpProvider } from "./mock.otp.provider";

export class OtpProviderFactory {
    public static getProvider(): IOtpProvider {
        const providerName = (process.env.OTP_PROVIDER || "mock").toLowerCase();

        switch (providerName) {
            case "msg91":
                return new Msg91OtpProvider();
            case "mock":
            default:
                return new MockOtpProvider();
        }
    }
}
