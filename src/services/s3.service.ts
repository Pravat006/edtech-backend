import { GetObjectCommand, S3Client, CreateMultipartUploadCommand, PutObjectCommand, AbortMultipartUploadCommand, UploadPartCommand, CompleteMultipartUploadCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import envVars from "@/config/envVars";

type UploadStrategy = "SINGLE_PART" | "MULTIPART";

class S3Service {
    private s3Client: S3Client;
    private readonly MULTIPART_THRESHOLD = 100n * (1024n * 1024n);

    constructor() {
        this.s3Client = new S3Client({
            region: envVars.AWS_REGION,
            credentials: {
                accessKeyId: envVars.AWS_ACCESS_KEY_ID,
                secretAccessKey: envVars.AWS_SECRET_ACCESS_KEY
            }
        });
    }

    decideStrategy(size: bigint): UploadStrategy {
        if (size < this.MULTIPART_THRESHOLD) {
            return "SINGLE_PART";
        }
        return "MULTIPART";
    }

    async getPutObjectUrl(key: string, contentType: string, expiresIn = 600) {
        const command = new PutObjectCommand({
            Bucket: envVars.S3_BUCKET_NAME,
            Key: key,
            ContentType: contentType
        });
        return getSignedUrl(this.s3Client, command, { expiresIn });
    }

    async createMultipartUpload(key: string, contentType: string) {
        const command = new CreateMultipartUploadCommand({
            Bucket: envVars.S3_BUCKET_NAME,
            Key: key,
            ContentType: contentType
        });
        return await this.s3Client.send(command);
    }

    async getUploadPartUrl(key: string, partNumber: number, uploadId: string, expiresIn = 600) {
        const command = new UploadPartCommand({
            Bucket: envVars.S3_BUCKET_NAME,
            Key: key,
            UploadId: uploadId,
            PartNumber: partNumber
        });
        return getSignedUrl(this.s3Client, command, { expiresIn });
    }

    async completeMultiPartUpload(
        key: string,
        uploadId: string,
        parts: { ETag: string, PartNumber: number }[]
    ) {
        const command = new CompleteMultipartUploadCommand({
            Bucket: envVars.S3_BUCKET_NAME,
            Key: key,
            UploadId: uploadId,
            MultipartUpload: { Parts: parts }
        });
        return this.s3Client.send(command);
    }

    async abortMultipartUpload(key: string, uploadId: string) {
        const command = new AbortMultipartUploadCommand({
            Bucket: envVars.S3_BUCKET_NAME,
            Key: key,
            UploadId: uploadId
        });
        return await this.s3Client.send(command);
    }

    async getObjectUrl(key: string, expiresIn = 3600) {
        const command = new GetObjectCommand({
            Bucket: envVars.S3_BUCKET_NAME,
            Key: key
        });
        return getSignedUrl(this.s3Client, command, { expiresIn });
    }


    async deleteObject(key: string) {
        const command = new DeleteObjectCommand({
            Bucket: envVars.S3_BUCKET_NAME,
            Key: key
        });
        return await this.s3Client.send(command);
    }
}

export default S3Service;