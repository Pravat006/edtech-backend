import { Request, Response } from "express";
import { communityService } from "./community.service";
import httpStatus from "http-status";

export class CommunityController {
    public getDiscovery = async (req: Request, res: Response) => {
        const userId = req.user!.id;
        const data = await communityService.getDiscovery(userId);
        res.status(httpStatus.OK).json({
            success: true,
            data,
        });
    };

    public searchPeers = async (req: Request, res: Response) => {
        const userId = req.user!.id;
        const query = req.query.query as string | undefined;
        const data = await communityService.searchPeers(userId, query);
        res.status(httpStatus.OK).json({
            success: true,
            data,
        });
    };
}

export const communityController = new CommunityController();
