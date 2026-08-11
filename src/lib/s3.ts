import { APIError } from "@/utils/APIError";

export const uploadAsset = async (): Promise<never> => {
    throw new APIError(501, "S3 helper is not configured yet.");
};

