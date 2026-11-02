import { and, desc, eq, gt } from "drizzle-orm";
import { OrderStatus } from "@tickethub/shared";
import { db } from "../database/db";
import { orders } from "../database/schema";

/** UC03-E4: a buyer may resume their own unexpired pending order. */
export async function findActivePendingOrder(userId: string, eventId: string) {
  const [pending] = await db
    .select({ id: orders.id, expiresAt: orders.expiresAt })
    .from(orders)
    .where(
      and(
        eq(orders.userId, userId),
        eq(orders.eventId, eventId),
        eq(orders.status, OrderStatus.PENDING),
        gt(orders.expiresAt, new Date()),
      ),
    )
    .orderBy(desc(orders.createdAt), desc(orders.id))
    .limit(1);

  return pending ?? null;
}
