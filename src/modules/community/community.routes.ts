import { Router } from "express";
import { authenticateUser } from "@/middlewares/auth.middleware";
import { communityController } from "./community.controller";

const router = Router();

router.get("/discovery", authenticateUser, communityController.getDiscovery);
router.get("/peers", authenticateUser, communityController.searchPeers);

export const communityRoutes = router;
