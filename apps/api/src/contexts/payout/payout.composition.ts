import { PayoutCommands } from "./application/payout-commands.service";
import { PayoutQueries } from "./application/payout-queries.service";
import { ReconciliationQueries } from "./application/reconciliation-queries.service";
import type {
  PayoutQueryPort,
  PayoutRepository,
  ReconciliationReader,
} from "./domain/payout.ports";
import {
  DrizzlePayoutQuery,
  DrizzlePayoutRepository,
} from "./infrastructure/drizzle-payout.repository";
import { DrizzleReconciliationReader } from "./infrastructure/drizzle-reconciliation.reader";

export function createPayoutServices(
  overrides: {
    payouts?: PayoutRepository;
    query?: PayoutQueryPort;
    reconciliation?: ReconciliationReader;
  } = {},
) {
  return {
    commands: new PayoutCommands(
      overrides.payouts ?? new DrizzlePayoutRepository(),
    ),
    queries: new PayoutQueries(overrides.query ?? new DrizzlePayoutQuery()),
    reconciliations: new ReconciliationQueries(
      overrides.reconciliation ?? new DrizzleReconciliationReader(),
    ),
  };
}
