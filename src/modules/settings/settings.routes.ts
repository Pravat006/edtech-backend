import { Router } from "express";
import { SettingsController } from "./settings.controller";
import { validateRequest } from "@/middlewares/validateRequest";
import {
    CreateCategoryConfigSchema,
    UpdateCategoryConfigSchema,
    UpsertPlatformSettingsBatchSchema,
} from "./settings.schema";
import { requirePermission, verifyAdmin } from "@/middlewares/verifyAdmin";

// --- Public Routes (/v1/public/settings) ---
export const publicSettingsRouter = Router();

publicSettingsRouter.get("/", SettingsController.getPublicSettings);
publicSettingsRouter.get("/categories", SettingsController.getPublicCategories);

// --- Admin Routes (/v1/admin/settings) ---
export const adminSettingsRouter = Router();

// Middleware: Requires admin auth and SETTINGS_WRITE or SETTINGS_READ
adminSettingsRouter.use(verifyAdmin);

adminSettingsRouter.get(
    "/",
    requirePermission("settings:read"),
    SettingsController.getAdminSettings
);
adminSettingsRouter.put(
    "/",
    requirePermission("settings:write"),
    validateRequest(UpsertPlatformSettingsBatchSchema),
    SettingsController.upsertAdminSettings
);

adminSettingsRouter.get(
    "/categories",
    requirePermission("settings:read"),
    SettingsController.getAdminCategories
);
adminSettingsRouter.post(
    "/categories",
    requirePermission("settings:write"),
    validateRequest(CreateCategoryConfigSchema),
    SettingsController.createCategory
);
adminSettingsRouter.patch(
    "/categories/:id",
    requirePermission("settings:write"),
    validateRequest(UpdateCategoryConfigSchema),
    SettingsController.updateCategory
);
adminSettingsRouter.delete(
    "/categories/:id",
    requirePermission("settings:write"),
    SettingsController.deleteCategory
);
