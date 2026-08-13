import { Request, Response } from "express";
import httpStatus from "http-status";
import { APIError } from "@/utils/APIError";
import {
    SendOtp,
    VerifyOtp,
    ProfileSetup,
    RefreshToken
} from "./auth.schema";
import { authService } from "./auth.service";

const sendOtp = async (req: Request, res: Response) => {
    const { phoneNumber } = req.body as SendOtp;
    if (!phoneNumber) {
        throw new APIError(httpStatus.BAD_REQUEST, "Missing phone number.");
    }

    const result = await authService.sendOtp(phoneNumber);

    res.status(httpStatus.OK).json({
        success: true,
        message: "OTP sent to your phone via SMS.",
        expiresIn: result.expiresIn,
    });
};

const verifyOtpController = async (req: Request, res: Response) => {
    const { phoneNumber, otp } = req.body as VerifyOtp;
    if (!phoneNumber || !otp) {
        throw new APIError(httpStatus.BAD_REQUEST, "Phone number and OTP are required.");
    }

    const { isNewUser, user, tokens } = await authService.verifyOtp(phoneNumber, otp);

    res.status(httpStatus.OK).json({
        success: true,
        message: isNewUser ? "User registered successfully." : "User logged in successfully.",
        isNewUser,
        user: {
            id: user.id,
            phoneNumber: user.phoneNumber,
            name: user.name,
            email: user.email,
            referralCode: (user as any).referralCode?.code,
        },
        tokens,
    });
};

const setupProfile = async (req: Request, res: Response) => {
    const userId = req.user?.id;
    if (!userId) {
        throw new APIError(httpStatus.UNAUTHORIZED, "Unauthorized");
    }

    const data = req.body as ProfileSetup;
    const user = await authService.setupProfile(userId, data);

    res.status(httpStatus.OK).json({
        success: true,
        message: "Profile updated successfully.",
        user: {
            id: user.id,
            phoneNumber: user.phoneNumber,
            name: user.name,
            email: user.email,
        }
    });
};

const refreshTokens = async (req: Request, res: Response) => {
    const { token } = req.body as RefreshToken;
    if (!token) {
        throw new APIError(httpStatus.BAD_REQUEST, "Missing required fields: token is required");
    }

    const tokens = await authService.refreshTokens(token);

    res.status(httpStatus.OK).json({
        success: true,
        message: "Tokens refreshed successfully",
        data: tokens,
    });
};

const logout = async (req: Request, res: Response) => {
    const { token } = req.body as RefreshToken;
    if (!token) {
        throw new APIError(httpStatus.BAD_REQUEST, "Refresh token is required to logout");
    }

    authService.logout(token);

    res.status(httpStatus.OK).json({
        success: true,
        message: "Logged out successfully",
    });
};

export const userAuth = {
    sendOtp,
    verifyOtp: verifyOtpController,
    setupProfile,
    refreshTokens,
    logout,
};
