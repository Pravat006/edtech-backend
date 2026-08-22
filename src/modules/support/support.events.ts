import { EventEmitter } from "events";

class SupportEventEmitter extends EventEmitter {}

export const supportEventEmitter = new SupportEventEmitter();
// Increase max listeners for multiple simultaneous admin/user connections
supportEventEmitter.setMaxListeners(100);

export const emitNewMessage = (ticketId: string, messageData: any) => {
    supportEventEmitter.emit(`ticket:${ticketId}`, {
        type: "NEW_MESSAGE",
        data: messageData,
    });
};

export const emitTicketUpdated = (ticketId: string, ticketData: any) => {
    supportEventEmitter.emit(`ticket:${ticketId}`, {
        type: "TICKET_UPDATED",
        data: ticketData,
    });
};
