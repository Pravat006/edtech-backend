import ImageKit from "@imagekit/nodejs";
import envVars from "./envVars";

export const imagekit = new ImageKit({
    privateKey: envVars.IMAGEKIT_PRIVATE_KEY,
    webhookSecret: envVars.IMAGEKIT_WEBHOOK_SECRET || null,
});

export default imagekit;
