import {
  pgTable,
  uuid,
  varchar,
  text,
  numeric,
  integer,
  boolean,
  timestamp,
} from "drizzle-orm/pg-core";
import { events } from "./events";

export const ticketTypes = pgTable("ticket_types", {
  id: uuid("id").primaryKey().defaultRandom(),
  eventId: uuid("event_id")
    .notNull()
    .references(() => events.id, { onDelete: "cascade" }),
  name: varchar("name", { length: 100 }).notNull(),
  description: text("description"),
  price: numeric("price", { precision: 14, scale: 2 }).notNull(),
  capacity: integer("capacity").notNull(),
  heldCount: integer("held_count").notNull().default(0),
  soldCount: integer("sold_count").notNull().default(0),
  isSeated: boolean("is_seated").notNull().default(true),
  // Ma data-zone tren so do cua su kien.
  mapZone: varchar("map_zone", { length: 50 }),
  saleStartTime: timestamp("sale_start_time", { withTimezone: true }).notNull(),
  saleEndTime: timestamp("sale_end_time", { withTimezone: true }).notNull(),
  maxPerOrder: integer("max_per_order").notNull().default(6),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});
