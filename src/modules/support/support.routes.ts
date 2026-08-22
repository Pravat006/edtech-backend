import { Router } from "express";
import { authenticateUser } from "@/middlewares/auth.middleware";
import * as supportController from "./support.controller";

const router = Router();

router.use(authenticateUser);

router.post("/tickets", supportController.createTicket);
router.get("/tickets", supportController.getUserTickets);
router.get("/tickets/:ticketId", supportController.getTicketDetail);
router.get("/tickets/:ticketId/stream", supportController.streamTicketMessages);
router.post("/tickets/:ticketId/messages", supportController.addMessage);
router.patch("/tickets/:ticketId/close", supportController.closeTicket);

export default router;
