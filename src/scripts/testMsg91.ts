import dotenv from "dotenv";
import path from "path";

dotenv.config({ path: path.join(__dirname, "../../.env") });

import { Msg91OtpProvider } from "../services/otp/msg91.otp.provider";

async function testSendOtp() {
    const phoneNumber = process.argv[2] || "+15597455839";
    console.log("---------------------------------------------------------");
    console.log(`[Test] MSG91_AUTH_KEY: ${process.env.MSG91_AUTH_KEY ? "CONFIGURED (hidden)" : "MISSING"}`);
    console.log(`[Test] MSG91_TEMPLATE_ID: ${process.env.MSG91_TEMPLATE_ID || "(empty - using default template)"}`);
    console.log(`[Test] Target Phone Number: ${phoneNumber}`);
    console.log("---------------------------------------------------------");

    const provider = new Msg91OtpProvider();
    try {
        const result = await provider.sendOtp(phoneNumber);
        console.log("[Test Result] SUCCESS:", result);
    } catch (error: any) {
        console.error("[Test Result] FAILED:", error.message || error);
    }
}

testSendOtp();
