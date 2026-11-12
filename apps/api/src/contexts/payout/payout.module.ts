import { Module } from "@nestjs/common";
import { PayoutCommands } from "./application/payout-commands.service";
import { PayoutQueries } from "./application/payout-queries.service";
import { ReconciliationQueries } from "./application/reconciliation-queries.service";
import { AdminPayoutsController } from "./interface/admin-payouts.controller";
import { OrganizerPayoutsController } from "./interface/organizer-payouts.controller";
import { createPayoutServices } from "./payout.composition";

const PAYOUT_SERVICES = Symbol("PAYOUT_SERVICES");
type PayoutServices = ReturnType<typeof createPayoutServices>;

@Module({
  controllers: [AdminPayoutsController, OrganizerPayoutsController],
  providers: [
    { provide: PAYOUT_SERVICES, useFactory: () => createPayoutServices() },
    {
      provide: PayoutCommands,
      useFactory: (s: PayoutServices) => s.commands,
      inject: [PAYOUT_SERVICES],
    },
    {
      provide: PayoutQueries,
      useFactory: (s: PayoutServices) => s.queries,
      inject: [PAYOUT_SERVICES],
    },
    {
      provide: ReconciliationQueries,
      useFactory: (s: PayoutServices) => s.reconciliations,
      inject: [PAYOUT_SERVICES],
    },
  ],
  exports: [PayoutCommands, PayoutQueries, ReconciliationQueries],
})
export class PayoutModule {}
