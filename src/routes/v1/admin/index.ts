import { Router } from "express";
import { authenticateAdmin } from "@/middlewares/admin.middleware";
import adminAIChatRoutes from "@/modules/admin/ai-chat/admin-ai-chat.routes";

const router = Router();

router.use(authenticateAdmin);

router.use("/ai-chat", adminAIChatRoutes);

export default router;
