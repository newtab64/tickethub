import { createTicketingServices } from "../../src/contexts/ticketing/ticketing.composition";
import type { QrTokenService } from "../../src/contexts/ticketing/domain/ticketing.ports";

/** Gom dich vu cua hai nhom chuc nang (vi ve, soat ve) de test goi mot cho. */
export function createTicketsFacade(qrTokens?: QrTokenService) {
  const t = createTicketingServices(qrTokens ? { qrTokens } : {});
  return {
    buyer: t.buyerTickets,
    gate: t.gateCheckIn,
    getTicketQr: t.buyerTickets.getTicketQr.bind(t.buyerTickets),
    getMyTickets: t.buyerTickets.getMyTickets.bind(t.buyerTickets),
    scanTicket: t.gateCheckIn.scanTicket.bind(t.gateCheckIn),
    lookupTicket: t.gateCheckIn.lookupTicket.bind(t.gateCheckIn),
  };
}

export type TicketsFacade = ReturnType<typeof createTicketsFacade>;
