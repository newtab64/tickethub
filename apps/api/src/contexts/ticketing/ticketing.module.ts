import { Module } from "@nestjs/common";
import { IdentityModule } from "../identity/identity.module";
import { BuyerTicketService } from "./application/buyer-ticket.service";
import { GateCheckInService } from "./application/gate-checkin.service";
import { GateController } from "./interface/gate.controller";
import { TicketsController } from "./interface/tickets.controller";
import { createTicketingServices } from "./ticketing.composition";

const TICKETING_SERVICES = Symbol("TICKETING_SERVICES");
type TicketingServices = ReturnType<typeof createTicketingServices>;

@Module({
  imports: [IdentityModule],
  controllers: [TicketsController, GateController],
  providers: [
    {
      provide: TICKETING_SERVICES,
      useFactory: () => createTicketingServices(),
    },
    {
      provide: BuyerTicketService,
      useFactory: (s: TicketingServices) => s.buyerTickets,
      inject: [TICKETING_SERVICES],
    },
    {
      provide: GateCheckInService,
      useFactory: (s: TicketingServices) => s.gateCheckIn,
      inject: [TICKETING_SERVICES],
    },
  ],
  exports: [BuyerTicketService, GateCheckInService],
})
export class TicketingModule {}
