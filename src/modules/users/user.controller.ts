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
