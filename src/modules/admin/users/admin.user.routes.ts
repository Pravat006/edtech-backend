import { Router } from "express";
import * as userController from "./admin.user.controller";
import { verifyAdmin, requirePermission, requireSuperAdmin } from "@/middlewares/verifyAdmin";

const router = Router();

router.use(verifyAdmin);

router.get(
    "/",
    requirePermission("USERS_READ"),
    userController.listUsers
);

router.get(
    "/:userId",
    requirePermission("USERS_READ"),
    userController.getUserById
);

router.post(
    "/:userId/enroll",
    requirePermission("USERS_WRITE"),
    userController.manualEnrollUser
);

router.post(
    "/demo-user",
    requirePermission("USERS_WRITE"),
    userController.createDemoUser
);

router.delete(
    "/:userId",
    requireSuperAdmin,
    userController.deleteUser
);

export default router;
