import { Router } from "express";
import { authenticateUser } from "@/middlewares/auth.middleware";
import * as wishlistController from "./wishlist.controller";

const router = Router();

router.use(authenticateUser);

router.get("/", wishlistController.getWishlist);
router.post("/:courseId", wishlistController.addToWishlist);
router.delete("/:courseId", wishlistController.removeFromWishlist);
router.get("/:courseId/check", wishlistController.checkWishlist);

export default router;
