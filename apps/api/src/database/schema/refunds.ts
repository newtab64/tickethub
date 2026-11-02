import {
  pgTable,
  uuid,
  varchar,
  text,
  numeric,
  integer,
  timestamp,
  boolean,
  uniqueIndex,
  check,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { RefundStatus } from "@tickethub/shared";
import { orders } from "./orders";
import { tickets } from "./tickets";

export const refunds = pgTable(
  "refunds",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orderId: uuid("order_id")
      .notNull()
      .references(() => orders.id),
    ticketId: uuid("ticket_id").references(() => tickets.id),
    amount: numeric("amount", { precision: 14, scale: 2 }).notNull(),
    reason: text("reason").notNull(),
    status: varchar("status", { length: 20 })
      .notNull()
      .default(RefundStatus.PENDING)
      .$type<RefundStatus>(),
    providerRefundRef: varchar("provider_refund_ref", { length: 100 }),

    providerRequestId: varchar("provider_request_id", {
      length: 32,
    }).unique(),

    needsReconciliation: boolean("needs_reconciliation")
      .notNull()
      .default(false),

    lastAttemptAt: timestamp("last_attempt_at", { withTimezone: true }),

    idempotencyKey: varchar("idempotency_key", { length: 100 })
      .notNull()
      .unique(),
    retryCount: integer("retry_count").notNull().default(0),
    errorMessage: text("error_message"),
    processedAt: timestamp("processed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    // Mỗi vé chỉ có tối đa 1 refund đang hoạt động hoặc đã hoàn thành.
    uniqueIndex("uq_refunds_active_ticket").on(table.ticketId).where(sql`
        ${table.ticketId} IS NOT NULL
        AND ${table.status} IN ('PENDING', 'PROCESSING', 'COMPLETED')
      `),

    // Mỗi đơn chỉ có tối đa 1 refund toàn đơn (ticketId NULL) đang hoạt động.
    uniqueIndex("uq_refunds_active_full_order").on(table.orderId).where(sql`
        ${table.ticketId} IS NULL
        AND ${table.status} IN ('PENDING', 'PROCESSING', 'COMPLETED')
      `),

    check("chk_refunds_amount_positive", sql`${table.amount} > 0`),

    check("chk_refunds_retry_nonnegative", sql`${table.retryCount} >= 0`),
  ],
);
