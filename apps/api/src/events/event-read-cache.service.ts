import { Inject, Injectable, Logger, NotFoundException } from "@nestjs/common";
import Redis from "ioredis";
import { and, eq, sql } from "drizzle-orm";
import { EventStatus, SeatStatus } from "@tickethub/shared";

import { db } from "../database/db";
import { events, seats, ticketTypes } from "../database/schema";
import { REDIS_CLIENT } from "../database/redis.module";
import { EventsService } from "./events.service";

@Injectable()
export class EventReadCacheService {
  private readonly logger = new Logger(EventReadCacheService.name);

  private readonly TTL_SECONDS = 60;

  constructor(
    @Inject(REDIS_CLIENT)
    private readonly redis: Redis,

    @Inject(EventsService)
    private readonly eventsService: EventsService,
  ) {}

  // Cache-aside: Redis hong -> doc PostgreSQL
  private async cached<T>(key: string, loader: () => Promise<T>): Promise<T> {
    try {
      const raw = await this.redis.get(key);

      if (raw !== null) {
        return JSON.parse(raw) as T;
      }
    } catch (error) {
      this.logger.warn(`Redis GET failed, using PostgreSQL: ${String(error)}`);
    }

    // PostgreSQL la nguon du lieu chinh
    const data = await loader();

    try {
      await this.redis.set(key, JSON.stringify(data), "EX", this.TTL_SECONDS);
    } catch (error) {
      this.logger.warn(`Redis SET failed: ${String(error)}`);
    }

    return data;
  }

  // Cache so do ghe 60 giay
  async getSeatMap(eventId: string) {
    return this.cached(`w03:seatmap:v1:${eventId}`, () =>
      this.eventsService.getEventSeatMap(eventId),
    );
  }

  // Cache ton kho ve 60 giay
  async getInventory(eventId: string) {
    return this.cached(`w03:inventory:v1:${eventId}`, () =>
      this.loadInventory(eventId),
    );
  }

  private async loadInventory(eventId: string) {
    const event = await db.query.events.findFirst({
      where: and(
        eq(events.id, eventId),
        eq(events.status, EventStatus.PUBLISHED),
      ),
      columns: {
        id: true,
      },
    });

    if (!event) {
      throw new NotFoundException("Khong tim thay su kien dang mo ban");
    }

    const types = await db.query.ticketTypes.findMany({
      where: eq(ticketTypes.eventId, eventId),
      columns: {
        id: true,
        name: true,
        price: true,
        capacity: true,
        heldCount: true,
        soldCount: true,
        isSeated: true,
      },
      orderBy: (table, { asc }) => [asc(table.sortOrder)],
    });

    // Ghe ngoi: dem trang thai trong bang seats
    const seatCounts = await db
      .select({
        ticketTypeId: seats.ticketTypeId,

        available: sql<number>`
          COUNT(*) FILTER (
            WHERE ${seats.status} = ${SeatStatus.AVAILABLE}
            OR (
              ${seats.status} = ${SeatStatus.HELD}
              AND ${seats.holdExpiresAt} < NOW()
            )
          )::integer
        `,

        held: sql<number>`
          COUNT(*) FILTER (
            WHERE ${seats.status} = ${SeatStatus.HELD}
            AND (
              ${seats.holdExpiresAt} IS NULL
              OR ${seats.holdExpiresAt} >= NOW()
            )
          )::integer
        `,

        sold: sql<number>`
          COUNT(*) FILTER (
            WHERE ${seats.status} = ${SeatStatus.SOLD}
          )::integer
        `,

        blocked: sql<number>`
          COUNT(*) FILTER (
            WHERE ${seats.status} = ${SeatStatus.BLOCKED}
          )::integer
        `,
      })
      .from(seats)
      .where(eq(seats.eventId, eventId))
      .groupBy(seats.ticketTypeId);

    const seatCountMap = new Map(
      seatCounts.map((item) => [item.ticketTypeId, item]),
    );

    const items = types.map((tt) => {
      if (!tt.isSeated) {
        // Ve dung: su dung counter
        return {
          ticketTypeId: tt.id,
          name: tt.name,
          price: tt.price,
          isSeated: false,
          capacity: tt.capacity,
          available: Math.max(0, tt.capacity - tt.heldCount - tt.soldCount),
          held: tt.heldCount,
          sold: tt.soldCount,
          blocked: 0,
        };
      }

      // Ghe ngoi: dem tu seats
      const count = seatCountMap.get(tt.id);

      return {
        ticketTypeId: tt.id,
        name: tt.name,
        price: tt.price,
        isSeated: true,
        capacity: tt.capacity,
        available: count?.available ?? 0,
        held: count?.held ?? 0,
        sold: count?.sold ?? 0,
        blocked: count?.blocked ?? 0,
      };
    });

    return {
      eventId,
      items,
      refreshedAt: new Date().toISOString(),
    };
  }

  // Se dung de xoa cache sau cac thay doi ve
  async invalidate(eventId: string): Promise<void> {
    try {
      await this.redis.del(
        `w03:seatmap:v1:${eventId}`,
        `w03:inventory:v1:${eventId}`,
      );
    } catch (error) {
      this.logger.warn(`Redis invalidation failed: ${String(error)}`);
    }
  }
}
