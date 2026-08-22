import { Router } from "express";
import { verifyAdmin } from "@/middlewares/verifyAdmin";
import * as adminSupportController from "./admin.support.controller";

const router = Router();

router.use(verifyAdmin);

router.get("/tickets", adminSupportController.getAllTickets);
router.get("/tickets/:ticketId", adminSupportController.getTicketDetail);
router.get("/tickets/:ticketId/stream", adminSupportController.streamAdminTicketMessages);
router.post("/tickets/:ticketId/reply", adminSupportController.addAdminReply);
router.patch("/tickets/:ticketId/metadata", adminSupportController.updateTicketMetadata);
router.get("/metrics", adminSupportController.getSupportMetrics);

export default router;
