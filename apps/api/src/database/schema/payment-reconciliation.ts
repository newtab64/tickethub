import {
  pgTable,
  uuid,
  varchar,
  integer,
  timestamp,
  index,
} from "drizzle-orm/pg-core";
import { transactions } from "./transactions";

/** Durable state for reconciliation of PAYMENT (not refund) transactions. */
export const paymentReconciliations = pgTable(
  "payment_reconciliations",
  {
    transactionId: uuid("transaction_id")
      .primaryKey()
      .references(() => transactions.id),
    status: varchar("status", { length: 20 })
      .$type<"PENDING" | "DONE" | "NEEDS_ATTENTION">()
      .notNull()
      .default("PENDING"),
    attemptCount: integer("attempt_count").notNull().default(0),
    nextRunAt: timestamp("next_run_at", { withTimezone: true }).notNull(),
    leaseUntil: timestamp("lease_until", { withTimezone: true }),
    leaseToken: uuid("lease_token"),
    lastDecision: varchar("last_decision", { length: 64 }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("idx_payment_reconciliation_schedule").on(
      table.status,
      table.nextRunAt,
    ),
  ],
);
