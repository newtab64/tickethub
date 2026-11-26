import { BuyerTicketService } from "./application/buyer-ticket.service";
import { GateCheckInService } from "./application/gate-checkin.service";
import type {
  GateRepository,
  MyTicketsReader,
  QrTokenService,
  TicketQrReader,
} from "./domain/ticketing.ports";
import {
  DrizzleGateRepository,
  DrizzleMyTicketsReader,
  DrizzleTicketQrReader,
} from "./infrastructure/drizzle-ticketing.repository";
import { Ed25519QrTokenService } from "./infrastructure/ed25519-qr-token.service";

export function createTicketingServices(
  overrides: {
    qrTokens?: QrTokenService;
    qrReader?: TicketQrReader;
    myTickets?: MyTicketsReader;
    gate?: GateRepository;
  } = {},
) {
  const qrTokens = overrides.qrTokens ?? new Ed25519QrTokenService();
  return {
    qrTokens,
    buyerTickets: new BuyerTicketService(
      overrides.qrReader ?? new DrizzleTicketQrReader(),
      qrTokens,
      overrides.myTickets ?? new DrizzleMyTicketsReader(),
    ),
    gateCheckIn: new GateCheckInService(
      overrides.gate ?? new DrizzleGateRepository(),
      qrTokens,
    ),
  };
}
