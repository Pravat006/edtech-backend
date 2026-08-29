import { IMediaProvider, IVideoStreamProvider } from "./media-provider.interface";
import { ImageKitMediaProvider } from "./imagekit.provider";
import { CloudinaryMediaProvider } from "./cloudinary.provider";
import { S3MediaProvider } from "./s3.provider";
import { BunnyStorageMediaProvider } from "./bunny-storage.provider";
import { BunnyStreamMediaProvider } from "./bunny-stream.provider";
import { logger } from "@/config/logger";
import { MEDIA_STORAGE_PROVIDER, VIDEO_STREAM_PROVIDER } from "@/config/env";

export class MediaProviderFactory {
    private static storageInstances: Map<string, IMediaProvider> = new Map();
    private static streamInstances: Map<string, IVideoStreamProvider> = new Map();

    /**
     * Gets static file media provider based on MEDIA_STORAGE_PROVIDER / MEDIA_PROVIDER env var (default: 'imagekit')
     */
    public static getMediaProvider(providerName?: string): IMediaProvider {
        const target = (
            providerName ||
            MEDIA_STORAGE_PROVIDER ||
            "imagekit"
        ).toLowerCase();

        if (this.storageInstances.has(target)) {
            return this.storageInstances.get(target)!;
        }

        let provider: IMediaProvider;

        switch (target) {
            case "bunny_storage":
                provider = new BunnyStorageMediaProvider();
                break;
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

        logger.info(`[MediaProviderFactory] Initialized static media provider: ${provider.name}`);
        this.storageInstances.set(target, provider);
        return provider;
    }

    /**
     * Gets video stream provider based on VIDEO_STREAM_PROVIDER env var (default: 'bunny_stream')
     */
    public static getVideoStreamProvider(providerName?: string): IVideoStreamProvider {
        const target = (providerName || VIDEO_STREAM_PROVIDER || "bunny_stream").toLowerCase();

        if (this.streamInstances.has(target)) {
            return this.streamInstances.get(target)!;
        }

        let provider: IVideoStreamProvider;

        switch (target) {
            case "bunny_stream":
            default:
                provider = new BunnyStreamMediaProvider();
                break;
        }

        logger.info(`[MediaProviderFactory] Initialized video stream provider: ${provider.name}`);
        this.streamInstances.set(target, provider);
        return provider;
    }

    /**
     * Backward-compatible alias for getMediaProvider()
     */
    public static getProvider(providerName?: string): IMediaProvider {
        return this.getMediaProvider(providerName);
    }
}
