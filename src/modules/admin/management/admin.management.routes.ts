import { Router } from "express";
import { validateRequest } from "@/middlewares/validateRequest";
import { verifyAdmin, requireSuperAdmin } from "@/middlewares/verifyAdmin";
import { CreateSubAdminSchema, UpdateSubAdminPermissionsSchema } from "./admin.management.schema";
import * as managementController from "./admin.management.controller";

const router = Router();

router.use(verifyAdmin);
router.use(requireSuperAdmin);

router.post("/", validateRequest(CreateSubAdminSchema), managementController.createSubAdmin);
router.get("/", managementController.listSubAdmins);
router.patch("/:id/permissions", validateRequest(UpdateSubAdminPermissionsSchema), managementController.updateSubAdminPermissions);
router.delete("/:id", managementController.revokeSubAdmin);

export default router;
