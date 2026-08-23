import { IMediaProvider } from "./media-provider.interface";
import { ImageKitMediaProvider } from "./imagekit.provider";
import { CloudinaryMediaProvider } from "./cloudinary.provider";
import { S3MediaProvider } from "./s3.provider";
import { logger } from "@/config/logger";

export class MediaProviderFactory {
    private static instances: Map<string, IMediaProvider> = new Map();

    /**
     * Gets active media provider based on MEDIA_PROVIDER env var (default: 'imagekit')
     */
    public static getProvider(providerName?: string): IMediaProvider {
        const target = (providerName || process.env.MEDIA_PROVIDER || "imagekit").toLowerCase();

        if (this.instances.has(target)) {
            return this.instances.get(target)!;
        }

        let provider: IMediaProvider;

        switch (target) {
            case "cloudinary":
                provider = new CloudinaryMediaProvider();
                break;
            case "s3":
                provider = new S3MediaProvider();
                break;
            case "imagekit":
            default:
                provider = new ImageKitMediaProvider();
                break;
        }

        logger.info(`[MediaProviderFactory] Initialized media provider: ${provider.name}`);
        this.instances.set(target, provider);
        return provider;
    }
}
