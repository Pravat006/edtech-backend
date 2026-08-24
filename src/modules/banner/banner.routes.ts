import { Router } from "express";
import { getPublicBannersController } from "./banner.controller";
import {
    getAllBannersAdminController,
    getBannerByIdAdminController,
    createBannerAdminController,
    updateBannerAdminController,
    deleteBannerAdminController,
    reorderBannersAdminController,
    uploadBannerImageAdminController,
} from "./admin.banner.controller";
import { verifyAdmin, requirePermission } from "@/middlewares/verifyAdmin";

// Public Router for Student Mobile App
export const publicBannerRouter = Router();
publicBannerRouter.get("/banners", getPublicBannersController);

// Admin Router for Admin Dashboard CMS
export const adminBannerRouter = Router();
adminBannerRouter.use(verifyAdmin);

adminBannerRouter.get(
    "/banners",
    requirePermission("SETTINGS_READ"),
    getAllBannersAdminController
);

adminBannerRouter.get(
    "/banners/:id",
    requirePermission("SETTINGS_READ"),
    getBannerByIdAdminController
);

adminBannerRouter.post(
    "/banners",
    requirePermission("SETTINGS_WRITE"),
    createBannerAdminController
);

adminBannerRouter.post(
    "/banners/upload",
    requirePermission("SETTINGS_WRITE"),
    uploadBannerImageAdminController
);

adminBannerRouter.put(
    "/banners/:id",
    requirePermission("SETTINGS_WRITE"),
    updateBannerAdminController
);

adminBannerRouter.delete(
    "/banners/:id",
    requirePermission("SETTINGS_WRITE"),
    deleteBannerAdminController
);

adminBannerRouter.patch(
    "/banners/reorder",
    requirePermission("SETTINGS_WRITE"),
    reorderBannersAdminController
);

export default publicBannerRouter;
