import { Router } from "express";
import { authenticateAdmin } from "@/middlewares/admin.middleware";
import adminAIChatRoutes from "@/modules/admin/ai-chat/admin-ai-chat.routes";
import { uploadRouter } from "@/modules/upload/upload.route";

const router = Router();

router.use(authenticateAdmin);

router.use("/ai-chat", adminAIChatRoutes);
router.use("/upload", uploadRouter);
router.use("/media", uploadRouter);

export default router;
