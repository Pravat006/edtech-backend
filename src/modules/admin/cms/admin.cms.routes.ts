import { Router } from "express";
import { verifyAdmin, requirePermission } from "@/middlewares/verifyAdmin";
import {
  getAllPagesAdmin,
  getPageByIdAdmin,
  createPageAdmin,
  updatePageAdmin,
  revertPageAdmin,
  deletePageAdmin,
} from "./admin.cms.controller";

const router = Router();

// All admin routes require admin session
router.use(verifyAdmin);

router.get(
  "/pages",
  requirePermission("SETTINGS_READ"),
  getAllPagesAdmin
);

router.get(
  "/pages/:id",
  requirePermission("SETTINGS_READ"),
  getPageByIdAdmin
);

router.post(
  "/pages",
  requirePermission("SETTINGS_WRITE"),
  createPageAdmin
);

router.put(
  "/pages/:id",
  requirePermission("SETTINGS_WRITE"),
  updatePageAdmin
);

router.post(
  "/pages/:id/revert/:revisionId",
  requirePermission("SETTINGS_WRITE"),
  revertPageAdmin
);

router.delete(
  "/pages/:id",
  requirePermission("SETTINGS_WRITE"),
  deletePageAdmin
);

export default router;
