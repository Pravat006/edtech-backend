import envVars from "@/config/envVars";
import jwt from "jsonwebtoken";
export type Payload = {
    id: string;
    jti: string;
};
const JWT_SECRET = envVars.JWT_SECRET;
export const signToken = (payload: Payload, expiresIn: string = "7d") => {
    return jwt.sign(payload, JWT_SECRET as string, {
        expiresIn: expiresIn as any,
    });
};

export const generateTokens = (payload: Payload) => {
    const accessToken = signToken(payload, "15m");
    const refreshToken = signToken(payload, "7d");

    return {
        accessToken,
        refreshToken,
    };
};

export const verifyToken = (token: string) => {
    return jwt.verify(token, JWT_SECRET as string);
};

export const revokeRefreshToken = (id: string, jti: string) => {

};

export const isRefreshTokenValid = (id: string, jti: string, token: string) => {
    try {
        verifyToken(token);
        return true;
    } catch {
        return false;
    }
};
