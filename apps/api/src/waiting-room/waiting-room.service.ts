import {
  Injectable,
  Inject,
  NotFoundException,
  ServiceUnavailableException,
} from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import Redis from "ioredis";
import { eq } from "drizzle-orm";
import { db } from "../database/db";
import { events } from "../database/schema";
import { isEventSoldOut } from "./waiting-room-inventory";
import { findActivePendingOrder } from "./waiting-room-pending-order";
import { clearDisabledWaitingRoom } from "./waiting-room-cleanup";
import { REDIS_CLIENT } from "../database/redis.module";
import { env } from "../config/env.config";
import { EventStatus } from "@tickethub/shared";
export interface WaitingRoomStatus {
  status: "ADMITTED" | "QUEUED" | "SOLD_OUT" | "PENDING_ORDER";
  orderId?: string;
  expiresAt?: string;
  admissionToken?: string;
  queuePosition?: number;
  estimatedWaitSeconds?: number;
  queueId?: string;
}

@Injectable()
export class WaitingRoomService {
  private readonly HEARTBEAT_TTL = 60;

  private redisUnavailable(): ServiceUnavailableException {
    return new ServiceUnavailableException({
      success: false,
      error: {
        code: "REDIS_UNAVAILABLE",
        message: "Redis tam thoi khong kha dung",
      },
    });
  }

  // Moi Redis command trong join/heartbeat deu fail-fast neu ket noi hong.
  private async redisCall<T>(operation: () => Promise<T>): Promise<T> {
    if (this.redis.status !== "ready") {
      throw this.redisUnavailable();
    }
    try {
      return await operation();
    } catch {
      throw this.redisUnavailable();
    }
  }

  private heartbeatKey(eventId: string, userId: string) {
    return `w03:waiting-room:hb:${eventId}:${userId}`;
  }

  private async touchHeartbeat(eventId: string, userId: string): Promise<void> {
    const results = await this.redisCall(() =>
      this.redis
        .multi()
        .set(this.heartbeatKey(eventId, userId), "1", "EX", this.HEARTBEAT_TTL)
        .sadd("w03:waiting-room:events", eventId)
        .exec(),
    );
    if (!results || results.some(([error]) => error !== null)) {
      throw this.redisUnavailable();
    }
  }

  constructor(
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
    private readonly jwtService: JwtService,
  ) {}

  async generateAdmissionToken(
    userId: string,
    eventId: string,
  ): Promise<string> {
    return this.jwtService.signAsync(
      {
        sub: userId,
        eventId,
        type: "waiting_room_admission",
      },
      {
        secret: env.JWT_SECRET,
        expiresIn: 600, // 10 phút theo đặc tả
      },
    );
  }

  async verifyAdmissionToken(
    token: string,
    eventId: string,
    userId: string,
  ): Promise<boolean> {
    try {
      const payload = await this.jwtService.verifyAsync(token, {
        secret: env.JWT_SECRET,
      });

      // Xac thuc danh tinh va pham vi token
      if (
        payload.type !== "waiting_room_admission" ||
        payload.sub !== userId ||
        payload.eventId !== eventId
      ) {
        return false;
      }

      // Kiem tra su kien con duoc phep ban ve
      const event = await db.query.events.findFirst({
        where: eq(events.id, eventId),
        columns: {
          status: true,
          isWaitingRoomEnabled: true,
        },
      });

      if (!event || event.status !== EventStatus.PUBLISHED) {
        return false;
      }

      // Su kien khong bat waiting room:
      // JWT hop le la du.
      if (!event.isWaitingRoomEnabled) {
        return true;
      }

      // Su kien bat waiting room:
      // Bat buoc phien Redis van active.
      const [isActive, heartbeatAlive] = await Promise.all([
        this.redis.sismember(`active_users:${eventId}`, userId),
        this.redis.exists(`w03:waiting-room:hb:${eventId}:${userId}`),
      ]);

      return isActive === 1 && heartbeatAlive === 1;
    } catch {
      return false;
    }
  }

  /** UC03-E4: remove a buyer from the queue without releasing an active slot. */
  private async resumePendingOrder(
    userId: string,
    eventId: string,
    order: { id: string; expiresAt: Date },
  ): Promise<WaitingRoomStatus> {
    const queueKey = `waiting_room:${eventId}`;
    const activeKey = `active_users:${eventId}`;
    await this.redisCall(() => this.redis.zrem(queueKey, userId));

    // UC03 rule: a valid held order keeps its active slot until terminal.
    const active = await this.redisCall(() =>
      this.redis.sismember(activeKey, userId),
    );
    if (active) {
      await this.touchHeartbeat(eventId, userId);
    } else {
      await this.redisCall(() =>
        this.redis.del(this.heartbeatKey(eventId, userId)),
      );
    }

    return {
      status: "PENDING_ORDER",
      orderId: order.id,
      expiresAt: order.expiresAt.toISOString(),
    };
  }

  async joinQueue(userId: string, eventId: string): Promise<WaitingRoomStatus> {
    const event = await db.query.events.findFirst({
      where: eq(events.id, eventId),
    });

    if (!event) {
      throw new NotFoundException({
        success: false,
        error: {
          code: "EVENT_NOT_FOUND",
          message: "Không tìm thấy sự kiện",
          timestamp: new Date().toISOString(),
        },
      });
    }

    // UC03-E6: disable must also purge the old Redis queue/active/heartbeat.
    if (!event.isWaitingRoomEnabled) {
      await this.redisCall(() => clearDisabledWaitingRoom(this.redis, eventId));
    }

    // UC03-E4: check current buyer's unexpired PENDING order BEFORE SOLD_OUT.
    // A buyer who already holds tickets must be able to resume their order.
    const pending = await findActivePendingOrder(userId, eventId);
    if (pending) {
      if (event.isWaitingRoomEnabled) {
        return this.resumePendingOrder(userId, eventId, pending);
      }
      return {
        status: "PENDING_ORDER",
        orderId: pending.id,
        expiresAt: pending.expiresAt.toISOString(),
      };
    }

    // UC03-TC19: inventory is the authoritative PostgreSQL state.
    if (await isEventSoldOut(eventId)) {
      return { status: "SOLD_OUT" };
    }

    if (!event.isWaitingRoomEnabled) {
      const admissionToken = await this.generateAdmissionToken(userId, eventId);
      return { status: "ADMITTED", admissionToken };
    }

    const activeKey = `active_users:${eventId}`;
    const queueKey = `waiting_room:${eventId}`;

    // Kiểm tra xem người dùng đã nằm trong danh sách active chưa

    const isAlreadyActive = await this.redisCall(() =>
      this.redis.sismember(activeKey, userId),
    );

    if (isAlreadyActive) {
      const isAlive = await this.redisCall(() =>
        this.redis.exists(this.heartbeatKey(eventId, userId)),
      );

      if (isAlive) {
        await this.touchHeartbeat(eventId, userId);

        const admissionToken = await this.generateAdmissionToken(
          userId,
          eventId,
        );

        return {
          status: "ADMITTED",
          admissionToken,
        };
      }

      // Phien cu het han: loai khoi active
      await this.redisCall(() => this.redis.srem(activeKey, userId));
    }

    const [activeCount, queueLen] = await Promise.all([
      this.redisCall(() => this.redis.scard(activeKey)),
      this.redisCall(() => this.redis.zcard(queueKey)),
    ]);

    // Nếu số người active còn dưới ngưỡng và hàng chờ đang rỗng -> Vào thẳng
    if (activeCount < event.maxActiveUsers && queueLen === 0) {
      await this.redisCall(() => this.redis.sadd(activeKey, userId));
      await this.touchHeartbeat(eventId, userId);
      const admissionToken = await this.generateAdmissionToken(userId, eventId);
      return {
        status: "ADMITTED",
        admissionToken,
      };
    }

    const oldRank = await this.redisCall(() =>
      this.redis.zrank(queueKey, userId),
    );

    if (
      oldRank !== null &&
      !(await this.redisCall(() =>
        this.redis.exists(this.heartbeatKey(eventId, userId)),
      ))
    ) {
      await this.redisCall(() => this.redis.zrem(queueKey, userId));
    }
    // Xếp hàng vào Redis Sorted Set với điểm số là thời điểm gia nhập
    let rank = await this.redisCall(() => this.redis.zrank(queueKey, userId));
    if (rank === null) {
      await this.redisCall(() => this.redis.zadd(queueKey, Date.now(), userId));
      rank = await this.redisCall(() => this.redis.zrank(queueKey, userId));
    }

    const position = (rank ?? 0) + 1;
    const estimatedWaitSeconds = Math.max(15, position * 15);
    await this.touchHeartbeat(eventId, userId);
    return {
      status: "QUEUED",
      queuePosition: position,
      estimatedWaitSeconds,
      queueId: `q_${userId}_${eventId}`,
    };
  }

  async heartbeat(userId: string, eventId: string): Promise<WaitingRoomStatus> {
    const event = await db.query.events.findFirst({
      where: eq(events.id, eventId),
    });

    if (!event) {
      throw new NotFoundException({
        success: false,
        error: {
          code: "EVENT_NOT_FOUND",
          message: "Không tìm thấy sự kiện",
          timestamp: new Date().toISOString(),
        },
      });
    }

    // UC03-E6: clean up even when heartbeat is the first request after disable.
    if (!event.isWaitingRoomEnabled) {
      await this.redisCall(() => clearDisabledWaitingRoom(this.redis, eventId));
    }

    // UC03-E4: prefer resuming a live pending order to SOLD_OUT/QUEUED.
    const pending = await findActivePendingOrder(userId, eventId);
    if (pending) {
      if (event.isWaitingRoomEnabled) {
        return this.resumePendingOrder(userId, eventId, pending);
      }
      return {
        status: "PENDING_ORDER",
        orderId: pending.id,
        expiresAt: pending.expiresAt.toISOString(),
      };
    }

    if (await isEventSoldOut(eventId)) {
      return { status: "SOLD_OUT" };
    }

    if (!event.isWaitingRoomEnabled) {
      const admissionToken = await this.generateAdmissionToken(userId, eventId);
      return { status: "ADMITTED", admissionToken };
    }

    const activeKey = `active_users:${eventId}`;
    const queueKey = `waiting_room:${eventId}`;

    const isAlreadyActive = await this.redisCall(() =>
      this.redis.sismember(activeKey, userId),
    );

    if (isAlreadyActive) {
      const alive = await this.redisCall(() =>
        this.redis.exists(this.heartbeatKey(eventId, userId)),
      );

      if (!alive) {
        await this.redisCall(() => this.redis.srem(activeKey, userId));
        return this.joinQueue(userId, eventId);
      }

      await this.touchHeartbeat(eventId, userId);

      const admissionToken = await this.generateAdmissionToken(userId, eventId);

      return {
        status: "ADMITTED",
        admissionToken,
      };
    }

    const [activeCount, rank] = await Promise.all([
      this.redisCall(() => this.redis.scard(activeKey)),
      this.redisCall(() => this.redis.zrank(queueKey, userId)),
    ]);

    if (rank === null) {
      // Chưa có trong hàng chờ, gọi joinQueue
      return this.joinQueue(userId, eventId);
    }

    const heartbeatAlive = await this.redisCall(() =>
      this.redis.exists(this.heartbeatKey(eventId, userId)),
    );

    if (!heartbeatAlive) {
      await this.redisCall(() => this.redis.zrem(queueKey, userId));
      return this.joinQueue(userId, eventId);
    }

    await this.touchHeartbeat(eventId, userId);

    // Nếu đứng đầu hàng chờ và còn chỗ trống -> Nhận vào (promote)
    if (rank === 0 && activeCount < event.maxActiveUsers) {
      await Promise.all([
        this.redisCall(() => this.redis.zrem(queueKey, userId)),
        this.redisCall(() => this.redis.sadd(activeKey, userId)),
      ]);

      const admissionToken = await this.generateAdmissionToken(userId, eventId);
      return {
        status: "ADMITTED",
        admissionToken,
      };
    }

    const position = rank + 1;
    const estimatedWaitSeconds = Math.max(15, position * 15);

    return {
      status: "QUEUED",
      queuePosition: position,
      estimatedWaitSeconds,
      queueId: `q_${userId}_${eventId}`,
    };
  }

  async leaveActive(userId: string, eventId: string): Promise<void> {
    await this.redisCall(() =>
      this.redis.srem(`active_users:${eventId}`, userId),
    );
    await this.redisCall(() =>
      this.redis.del(this.heartbeatKey(eventId, userId)),
    );
  }
}
