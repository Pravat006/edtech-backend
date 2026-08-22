import { Router } from "express";
import { authenticateUser } from "@/middlewares/auth.middleware";
import { catchAsync } from "@/utils/catchAsync";
import { communityController } from "./community.controller";

const router = Router();

router.get("/discovery", authenticateUser, catchAsync(communityController.getDiscovery));
router.get("/peers", authenticateUser, catchAsync(communityController.searchPeers));

export const communityRoutes = router;
