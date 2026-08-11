import { Request, Response } from "express";
import { v4 as uuidv4 } from "uuid";
import crypto from "crypto";
import { db, redis } from "@/config/database";
import { generateOtp, verifyOtp } from "@/services/otp.service";
import userService from "@/services/user.service";
import { hashPassword, verifyPassword } from "@/tools/encryption";
import { APIError } from "@/utils/APIError";
import { z } from "zod";
import emailService from "@/services/email.service";
import {
    AdminLogin,
    ForgotPassword,
    Login,
    RefreshToken,
    Register,
    VerifyLogin,
    VerifyRegistration,
} from "@/@types/interface";
import {
    AccountType,
    generateTokens,
    Payload,
    verifyToken,
} from "@/services/token.service";

const initRegister = async (req: Request, res: Response) => {
    const { email, password, name } = req.body as Register;
    if (!email || !password || !name) {
        throw new APIError(400, "Missing required fields.");
    }
    const existingUser = await userService.getUserByEmail(email);
    if (existingUser) {
        throw new APIError(400, "User already exists with this email.");
    }
    const hashedPassword = await hashPassword(password as string);
    await redis.setValue(
        `register:${email}`,
        JSON.stringify({
            email,
            name,
            password: hashedPassword,
        }),
        60 * 5,
    );
    const otp = await generateOtp(email);
    await emailService.sendEmail({
        to: email,
        subject: "Your OTP Code",
        text: `Your OTP code is ${otp}. It is valid for 5 minutes.`,
    });
    res.status(200).json({
        success: true,
        message: "OTP sent to your email for registration.",
        otp,
    });
    return;
};

const verifyRegistration = async (req: Request, res: Response) => {
    const { email, otp } = req.body as VerifyRegistration;
    if (!email || !otp) {
        throw new APIError(400, "Email and OTP are required.");
    }
    const userData = await redis.getValue(`register:${email}`);
    if (!userData) {
        throw new APIError(400, "Registration session expired or not found.");
    }
    const parsedUser = JSON.parse(userData);
    const isVerified = await verifyOtp(email, otp);
    if (!isVerified) {
        throw new APIError(400, "Invalid OTP.");
    }
    const user = await userService.createUser({
        email: parsedUser.email,
        name: parsedUser.name,
        password: parsedUser.password,
    });
    const jti = uuidv4();
    const { accessToken, refreshToken } = generateTokens({
        accountType: AccountType.USER,
        id: user.id,
        jti,
    });
    await redis.deleteValue(`register:${email}`);

    res.status(201).json({
        success: true,
        message: "User registered successfully.",
        tokens: {
            accessToken,
            refreshToken,
        },
    });
    return;
};

const login = async (req: Request, res: Response) => {
    const { email, password } = req.body as Login;
    if (!email || !password) {
        throw new APIError(400, "Email and password are required.");
    }
    const user = await userService.getUserByEmail(email);
    if (!user) {
        throw new APIError(404, "User not found.");
    }

    const isPasswordValid = await verifyPassword(password as string, user.password);
    if (!isPasswordValid) {
        throw new APIError(401, "Invalid password.");
    }
    const jti = uuidv4();
    const tokens = generateTokens({
        id: user.id,
        jti,
        accountType: AccountType.USER,
    });
    res.status(200).json({
        success: true,
        message: "User logged in successfully.",
        user: {
            id: user.id,
            email: user.email,
            name: user.name,
        },
        tokens: {
            access_token: tokens.accessToken,
            refresh_token: tokens.refreshToken,
        },
    });
    return;
};

const resendOtpToMail = async (req: Request, res: Response) => {
    const { email } = req.body as ForgotPassword;
    if (!email) {
        throw new APIError(400, "Missing required fields: email is required");
    }
    try {
        const userExists = await userService.getUserByEmail(email);
        if (userExists) {
            throw new APIError(400, "User already verified, cannot resend OTP");
        }

        const registrationData = await redis.getValue(`register:${email}`);
        if (!registrationData) {
            throw new APIError(
                400,
                "No registration session found. Please start registration process again.",
            );
        }

        const otp = await generateOtp(email);

        res.status(200).json({
            success: true,
            message: "OTP sent successfully",
            otp,
        });
        return;
    } catch (error: any) {
        if (error instanceof APIError) {
            throw error;
        }
        if (error instanceof z.ZodError) {
            throw new APIError(
                400,
                error.issues.map((issue) => issue.message).join(", "),
            );
        }
        console.error("Error sending OTP:", error);
        throw new APIError(500, error.message);
    }
};

const forgotPassword = async (req: Request, res: Response) => {};

const resetPassword = async (req: Request, res: Response) => {};

const refreshTokens = async (req: Request, res: Response) => {
    const { token } = req.body as RefreshToken;
    if (!token) {
        throw new APIError(400, "Missing required fields: token is required");
    }
    try {
        const decodedToken: Payload = verifyToken(token) as Payload;
        if (!decodedToken) {
            throw new APIError(401, "Invalid or expired refresh token");
        }

        const user = await userService.getUserById(decodedToken.id);
        if (!user) {
            throw new APIError(404, "User not found");
        }

        const jti = crypto.randomUUID();
        const { accessToken, refreshToken: newRefreshToken } = generateTokens({
            accountType: AccountType.USER,
            id: user.id,
            jti,
        });

        res.status(200).json({
            success: true,
            message: "Tokens refreshed successfully",
            data: {
                accessToken,
                refreshToken: newRefreshToken,
            },
        });
        return;
    } catch (error: any) {
        if (error instanceof APIError) {
            throw error;
        }
        if (error instanceof z.ZodError) {
            throw new APIError(
                400,
                error.issues.map((issue) => issue.message).join(", "),
            );
        }
        console.error("Error refreshing tokens:", error);
        throw new APIError(500, error.message);
    }
};

const adminLogin = async (req: Request, res: Response) => {
    const { email } = req.body as AdminLogin;
    if (!email) {
        throw new APIError(400, "Email is required");
    }
    const adminCheck = await db.admin.findUnique({
        where: { email },
    });
    if (!adminCheck) {
        throw new APIError(404, "Admin not found");
    }
    const otp = await generateOtp(adminCheck.email);
    res.status(200).json({
        success: true,
        message: "admin otp sent.",
        otp,
    });
    return;
};

const verifyAdminLogin = async (req: Request, res: Response) => {
    const { otp, email } = req.body as VerifyLogin;
    if (!otp || !email) {
        throw new APIError(400, "OTP and email are required");
    }
    const isVerified = await verifyOtp(email, otp);
    if (!isVerified) {
        throw new APIError(400, "Failed to verify otp");
    }
    const admin = await db.admin.findUnique({
        where: { email },
    });
    if (!admin) {
        throw new APIError(404, "Admin not found");
    }
    const jti = uuidv4();

    const token = generateTokens({
        id: admin.id,
        accountType: AccountType.ADMIN,
        jti,
    });
    res.json({
        message: "Admin logged in successfully",
        tokens: {
            accessToken: token.accessToken,
            refreshToken: token.refreshToken,
        },
    });
    return;
};

export const userAuth = {
    initRegister,
    verifyRegistration,
    login,
    resetPassword,
    forgotPassword,
    resendOtpToMail,
    refreshTokens,
};

export const adminAuth = {
    login: adminLogin,
    verifyLogin: verifyAdminLogin,
};
