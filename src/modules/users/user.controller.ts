import { Request, Response } from "express";
import httpStatus from "http-status";
import { userService } from "./user.service";
import { UpdateProfile, UpdatePreferences } from "./user.schema";

export const getProfile = async (req: Request, res: Response) => {
    const user = await userService.getProfile(req.user!.id);
    res.status(httpStatus.OK).json({ success: true, data: user });
};

export const updateProfile = async (req: Request, res: Response) => {
    const data = req.body as UpdateProfile;
    const user = await userService.updateProfile(req.user!.id, data);
    res.status(httpStatus.OK).json({ success: true, message: "Profile updated successfully", data: user });
};

export const getPreferences = async (req: Request, res: Response) => {
    const preferences = await userService.getPreferences(req.user!.id);
    res.status(httpStatus.OK).json({ success: true, data: preferences });
};

export const updatePreferences = async (req: Request, res: Response) => {
    const data = req.body as UpdatePreferences;
    const preferences = await userService.updatePreferences(req.user!.id, data);
    res.status(httpStatus.OK).json({ success: true, message: "Preferences updated", data: preferences });
};

export const getWallet = async (req: Request, res: Response) => {
    const wallet = await userService.getWallet(req.user!.id);
    res.status(httpStatus.OK).json({ success: true, data: wallet });
};

export const getReferrals = async (req: Request, res: Response) => {
    const referrals = await userService.getReferrals(req.user!.id);
    res.status(httpStatus.OK).json({ success: true, data: referrals });
};

export const updatePushToken = async (req: Request, res: Response) => {
    const { token } = req.body;
    if (!token) {
        res.status(httpStatus.BAD_REQUEST).json({ success: false, message: "Push token is required" });
        return;
    }
    const result = await userService.updatePushToken(req.user!.id, token);
    res.status(httpStatus.OK).json({ success: true, message: "Push token updated", data: result });
};

export const requestPhoneChange = async (req: Request, res: Response) => {
    const { newPhoneNumber } = req.body;
    const result = await userService.requestPhoneChange(req.user!.id, newPhoneNumber);
    res.status(httpStatus.OK).json(result);
};

export const verifyPhoneChange = async (req: Request, res: Response) => {
    const { newPhoneNumber, code } = req.body;
    const result = await userService.verifyPhoneChange(req.user!.id, newPhoneNumber, code);
    res.status(httpStatus.OK).json(result);
};

export const requestEmailChange = async (req: Request, res: Response) => {
    const { newEmail } = req.body;
    const result = await userService.requestEmailChange(req.user!.id, newEmail);
    res.status(httpStatus.OK).json(result);
};

export const verifyEmailChange = async (req: Request, res: Response) => {
    const { newEmail, code } = req.body;
    const result = await userService.verifyEmailChange(req.user!.id, newEmail, code);
    res.status(httpStatus.OK).json(result);
};


