import { Request, Response } from "express";
import httpStatus from "http-status";
import { profileService } from "./profile.service";
import {
    UpdateAddress,
    UpdatePersonalDetails,
    UpdateEducationDetails,
} from "./profile.schema";

// ─── Address ─────────────────────────────────────────────────────────────────

export const getAddress = async (req: Request, res: Response) => {
    const userId = req.user!.id;
    const data = await profileService.getAddress(userId);
    res.status(httpStatus.OK).json({ success: true, data });
};

export const updateAddress = async (req: Request, res: Response) => {
    const userId = req.user!.id;
    const body = req.body as UpdateAddress;
    const data = await profileService.upsertAddress(userId, body);
    res.status(httpStatus.OK).json({
        success: true,
        message: "Address updated successfully.",
        data,
    });
};

// ─── Personal Details ─────────────────────────────────────────────────────────

export const getPersonalDetails = async (req: Request, res: Response) => {
    const userId = req.user!.id;
    const data = await profileService.getPersonalDetails(userId);
    res.status(httpStatus.OK).json({ success: true, data });
};

export const updatePersonalDetails = async (req: Request, res: Response) => {
    const userId = req.user!.id;
    const body = req.body as UpdatePersonalDetails;
    const data = await profileService.upsertPersonalDetails(userId, body);
    res.status(httpStatus.OK).json({
        success: true,
        message: "Personal details updated successfully.",
        data,
    });
};

// ─── Education Details ────────────────────────────────────────────────────────

export const getEducationDetails = async (req: Request, res: Response) => {
    const userId = req.user!.id;
    const data = await profileService.getEducationDetails(userId);
    res.status(httpStatus.OK).json({ success: true, data });
};

export const updateEducationDetails = async (req: Request, res: Response) => {
    const userId = req.user!.id;
    const body = req.body as UpdateEducationDetails;
    const data = await profileService.upsertEducationDetails(userId, body);
    res.status(httpStatus.OK).json({
        success: true,
        message: "Education details updated successfully.",
        data,
    });
};
