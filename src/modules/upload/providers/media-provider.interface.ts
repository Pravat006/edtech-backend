export interface UploadAuthParams {
    provider: "IMAGEKIT" | "CLOUDINARY" | "S3";
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
    readonly name: "IMAGEKIT" | "CLOUDINARY" | "S3";
    getAuthParameters(): UploadAuthParams;
    completeUpload(input: CompleteUploadInput): Promise<any>;
    deleteFile(storageKey: string): Promise<boolean>;
}
