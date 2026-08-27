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
router.patch("/:id/deactivate", managementController.deactivateSubAdmin);
router.patch("/:id/activate", managementController.activateSubAdmin);
router.patch("/:id/reassign", managementController.reassignSubAdmin);

export default router;
