import {
  pgTable,
  uuid,
  varchar,
  integer,
  numeric,
  boolean,
  timestamp,
  index,
  check,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { events } from "./events";
import { orders } from "./orders";

export const vouchers = pgTable(
  "vouchers",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    code: varchar("code", { length: 50 }).notNull().unique(),
    eventId: uuid("event_id")
      .notNull()
      .references(() => events.id),
    discountType: varchar("discount_type", { length: 10 })
      .$type<"PERCENT" | "FIXED">()
      .notNull(),
    discountValue: numeric("discount_value", {
      precision: 14,
      scale: 2,
    }).notNull(),
    minOrderAmount: numeric("min_order_amount", { precision: 14, scale: 2 })
      .notNull()
      .default("0"),
    maxUses: integer("max_uses"),
    startsAt: timestamp("starts_at", { withTimezone: true }).notNull(),
    endsAt: timestamp("ends_at", { withTimezone: true }).notNull(),
    isActive: boolean("is_active").notNull().default(true),
  },
  (table) => [
    check("chk_vouchers_value_positive", sql`${table.discountValue} > 0`),
    check(
      "chk_vouchers_percent_range",
      sql`${table.discountType} <> 'PERCENT' OR ${table.discountValue} <= 100`,
    ),
    check(
      "chk_vouchers_max_uses",
      sql`${table.maxUses} IS NULL OR ${table.maxUses} > 0`,
    ),
    check("chk_vouchers_period", sql`${table.startsAt} < ${table.endsAt}`),
    check("chk_vouchers_code_upper", sql`${table.code} = upper(${table.code})`),
  ],
);

// Theo dõi voucher đã được giữ hoặc sử dụng
export const voucherRedemptions = pgTable(
  "voucher_redemptions",
  {
    id: uuid("id").primaryKey().defaultRandom(),

    voucherId: uuid("voucher_id")
      .notNull()
      .references(() => vouchers.id),

    orderId: uuid("order_id")
      .notNull()
      .unique()
      .references(() => orders.id),

    status: varchar("status", { length: 20 })
      .$type<"RESERVED" | "REDEEMED" | "RELEASED">()
      .notNull()
      .default("RESERVED"),

    createdAt: timestamp("created_at", {
      withTimezone: true,
    })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("idx_voucher_redemptions_status").on(table.voucherId, table.status),
  ],
);
