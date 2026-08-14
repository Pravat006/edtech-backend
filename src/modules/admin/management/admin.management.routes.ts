import { Router } from "express";
import { validateRequest } from "@/middlewares/validateRequest";
import { verifyAdmin, requireSuperAdmin } from "@/middlewares/verifyAdmin";
import { CreateSubAdminSchema } from "./admin.management.schema";
import * as managementController from "./admin.management.controller";

const router = Router();

router.use(verifyAdmin);
router.use(requireSuperAdmin);

router.post("/", validateRequest(CreateSubAdminSchema), managementController.createSubAdmin);
router.get("/", managementController.listSubAdmins);
router.delete("/:id", managementController.revokeSubAdmin);

export default router;
