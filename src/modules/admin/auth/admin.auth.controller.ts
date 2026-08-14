import { Request, Response } from "express";
import httpStatus from "http-status";
import { APIError } from "@/utils/APIError";
import { AdminLogin } from "./admin.auth.schema";
import { adminAuthService } from "./admin.auth.service";

const COOKIE_OPTIONS = {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict" as const,
};

export const login = async (req: Request, res: Response) => {
    const data = req.body as AdminLogin;
    const { admin, tokens } = await adminAuthService.login(data);

    res.cookie("admin_access_token", tokens.accessToken, {
        ...COOKIE_OPTIONS,
        maxAge: 15 * 60 * 1000, // 15 minutes
    });
    res.cookie("admin_refresh_token", tokens.refreshToken, {
        ...COOKIE_OPTIONS,
        maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    });

    res.status(httpStatus.OK).json({
        success: true,
        message: "Admin logged in successfully",
        data: { admin },
    });
};

export const refreshTokens = async (req: Request, res: Response) => {
    const refreshToken = req.cookies?.admin_refresh_token;
    if (!refreshToken) {
        throw new APIError(httpStatus.UNAUTHORIZED, "No refresh token found");
    }

    const tokens = await adminAuthService.refreshTokens(refreshToken);

    res.cookie("admin_access_token", tokens.accessToken, {
        ...COOKIE_OPTIONS,
        maxAge: 15 * 60 * 1000,
    });
    res.cookie("admin_refresh_token", tokens.refreshToken, {
        ...COOKIE_OPTIONS,
        maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    res.status(httpStatus.OK).json({
        success: true,
        message: "Tokens refreshed successfully",
    });
};

export const logout = async (req: Request, res: Response) => {
    const refreshToken = req.cookies?.admin_refresh_token;
    if (refreshToken) {
        adminAuthService.logout(refreshToken);
    }

    res.clearCookie("admin_access_token", COOKIE_OPTIONS);
    res.clearCookie("admin_refresh_token", COOKIE_OPTIONS);

    res.status(httpStatus.OK).json({
        success: true,
        message: "Logged out successfully",
    });
};
