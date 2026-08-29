export interface UploadAuthParams {
    provider: "IMAGEKIT" | "CLOUDINARY" | "S3" | "BUNNY_STORAGE";
    signature: string;
    expire?: number;
    timestamp?: number;
    token?: string;
    apiKey?: string;
    cloudName?: string;
    uploadPreset?: string;
    endpoint?: string;
    publicKey?: string;
    [key: string]: any;
}

export interface CompleteUploadInput {
    userId: string;
    fileId: string;
    url: string;
    mimeType: string;
    size: number;
    storageKey?: string;
}

export interface IMediaProvider {
    readonly name: "IMAGEKIT" | "CLOUDINARY" | "S3" | "BUNNY_STORAGE";
    getAuthParameters(): UploadAuthParams;
    completeUpload(input: CompleteUploadInput): Promise<any>;
    deleteFile(storageKey: string): Promise<boolean>;
}

export interface VideoSlotResult {
    videoGuid: string;
    libraryId: string;
    title: string;
    status: number;
    bucket?: string;
    region?: string;
}

export interface VideoUploadAuth {
    videoGuid: string;
    libraryId: string;
    signature: string;
    expiration: number;
    tusEndpoint: string;
}

export interface IVideoStreamProvider {
    readonly name: "BUNNY_STREAM";
    createVideoSlot(title: string): Promise<VideoSlotResult>;
    getVideoUploadAuth(videoId: string): Promise<VideoUploadAuth>;
    generateSignedEmbedUrl(videoId: string, userIp?: string, ttlSeconds?: number): string;
    deleteVideo(videoId: string): Promise<boolean>;
}
