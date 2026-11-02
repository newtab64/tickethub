import { eq, sql } from "drizzle-orm";
import { SeatStatus } from "@tickethub/shared";
import { db } from "../database/db";
import { seats, ticketTypes } from "../database/schema";

export interface StockType {
  id: string;
  isSeated: boolean;
  capacity: number;
  soldCount: number;
}

export interface SeatStock {
  ticketTypeId: string;
  total: number;
  unsold: number;
}

export function isSoldOutByInventory(
  types: readonly StockType[],
  seatStock: readonly SeatStock[],
): boolean {
  if (types.length === 0) return false;
  const stockByType = new Map(seatStock.map((row) => [row.ticketTypeId, row]));

  return types.every((ticketType) => {
    if (!ticketType.isSeated) {
      return ticketType.soldCount >= ticketType.capacity;
    }
    const stock = stockByType.get(ticketType.id);
    if (stock && stock.total > 0) {
      // SOLD/BLOCKED khong con de ban; HELD van co kha nang duoc tra ve.
      return stock.unsold === 0;
    }
    // Du lieu ghe chua duoc tao: fallback counter, khong ket luan het ve oan.
    return ticketType.soldCount >= ticketType.capacity;
  });
}

/** Doc truc tiep PostgreSQL, khong dung Redis cached inventory (TTL 60s). */
export async function isEventSoldOut(eventId: string): Promise<boolean> {
  const types = await db
    .select({
      id: ticketTypes.id,
      isSeated: ticketTypes.isSeated,
      capacity: ticketTypes.capacity,
      soldCount: ticketTypes.soldCount,
    })
    .from(ticketTypes)
    .where(eq(ticketTypes.eventId, eventId));

  if (types.length === 0) return false;
  if (types.every((ticketType) => !ticketType.isSeated)) {
    return isSoldOutByInventory(types, []);
  }

  const seatStock = await db
    .select({
      ticketTypeId: seats.ticketTypeId,
      total: sql<number>`COUNT(*)::integer`,
      unsold: sql<number>`COUNT(*) FILTER (
        WHERE ${seats.status} NOT IN (${SeatStatus.SOLD}, ${SeatStatus.BLOCKED})
      )::integer`,
    })
    .from(seats)
    .where(eq(seats.eventId, eventId))
    .groupBy(seats.ticketTypeId);

  return isSoldOutByInventory(types, seatStock);
}
