import { Request, Response } from "express";
import httpStatus from "http-status";
import { APIError } from "@/utils/APIError";
import {
    SendOtp,
    VerifyOtp,
    ProfileSetup,
    RefreshToken,
    Login,
    SetPassword,
    ChangePassword
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

    const { isNewUser, setupToken } = await authService.verifyOtp(phoneNumber, otp);

    res.status(httpStatus.OK).json({
        success: true,
        message: isNewUser ? "Phone verified. Please set your password." : "Phone verified. Please reset your password.",
        isNewUser,
        setupToken,
    });
};

const setPasswordController = async (req: Request, res: Response) => {
    const data = req.body as SetPassword;
    if (!data.setupToken || !data.password) {
        throw new APIError(httpStatus.BAD_REQUEST, "Setup token and password are required.");
    }

    const { user, tokens } = await authService.setPassword(data);

    res.status(httpStatus.OK).json({
        success: true,
        message: "Password set successfully.",
        user: {
            id: user.id,
            phoneNumber: user.phoneNumber,
            name: user.name,
            email: user.email,
        },
        tokens,
    });
};

const loginController = async (req: Request, res: Response) => {
    const data = req.body as Login;
    if (!data.phoneNumber || !data.password) {
        throw new APIError(httpStatus.BAD_REQUEST, "Phone number and password are required.");
    }

    const { user, tokens } = await authService.login(data);

    res.status(httpStatus.OK).json({
        success: true,
        message: "User logged in successfully.",
        user: {
            id: user.id,
            phoneNumber: user.phoneNumber,
            name: user.name,
            email: user.email,
        },
        tokens,
    });
};

const changePasswordController = async (req: Request, res: Response) => {
    const data = req.body as ChangePassword;
    if (!data.oldPassword || !data.newPassword) {
        throw new APIError(httpStatus.BAD_REQUEST, "Old password and new password are required.");
    }

    const userId = req.user?.id;
    if (!userId) {
        throw new APIError(httpStatus.UNAUTHORIZED, "Unauthorized");
    }

    await authService.changePassword(userId, data);

    res.status(httpStatus.OK).json({
        success: true,
        message: "Password changed successfully.",
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
    setPassword: setPasswordController,
    changePassword: changePasswordController,
    login: loginController,
    setupProfile,
    refreshTokens,
    logout,
};
