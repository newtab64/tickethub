import { Injectable, Inject, NotFoundException } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import Redis from "ioredis";
import { eq } from "drizzle-orm";
import { db } from "../database/db";
import { events } from "../database/schema";
import { REDIS_CLIENT } from "../database/redis.module";
import { env } from "../config/env.config";
import {EventStatus } from "@tickethub/shared";
export interface WaitingRoomStatus {
  status: "ADMITTED" | "QUEUED";
  admissionToken?: string;
  queuePosition?: number;
  estimatedWaitSeconds?: number;
  queueId?: string;
}

@Injectable()
export class WaitingRoomService {
  private readonly HEARTBEAT_TTL = 60;

  private heartbeatKey(eventId: string, userId: string) {
    return `w03:waiting-room:hb:${eventId}:${userId}`;
  }

  private async touchHeartbeat(eventId: string, userId: string): Promise<void> {
    await this.redis
      .multi()
      .set(this.heartbeatKey(eventId, userId), "1", "EX", this.HEARTBEAT_TTL)
      .sadd("w03:waiting-room:events", eventId)
      .exec();
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

    // Nếu sự kiện không bật hàng chờ ảo, cấp token vào thẳng
    if (!event.isWaitingRoomEnabled) {
      const admissionToken = await this.generateAdmissionToken(userId, eventId);
      return {
        status: "ADMITTED",
        admissionToken,
      };
    }

    const activeKey = `active_users:${eventId}`;
    const queueKey = `waiting_room:${eventId}`;

    // Kiểm tra xem người dùng đã nằm trong danh sách active chưa

    const isAlreadyActive = await this.redis.sismember(activeKey, userId);

    if (isAlreadyActive) {
      const isAlive = await this.redis.exists(
        this.heartbeatKey(eventId, userId),
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
      await this.redis.srem(activeKey, userId);
    }

    if (isAlreadyActive) {
      const admissionToken = await this.generateAdmissionToken(userId, eventId);
      return {
        status: "ADMITTED",
        admissionToken,
      };
    }

    const [activeCount, queueLen] = await Promise.all([
      this.redis.scard(activeKey),
      this.redis.zcard(queueKey),
    ]);

    // Nếu số người active còn dưới ngưỡng và hàng chờ đang rỗng -> Vào thẳng
    if (activeCount < event.maxActiveUsers && queueLen === 0) {
      await this.redis.sadd(activeKey, userId);
      await this.touchHeartbeat(eventId, userId);
      const admissionToken = await this.generateAdmissionToken(userId, eventId);
      return {
        status: "ADMITTED",
        admissionToken,
      };
    }

    const oldRank = await this.redis.zrank(queueKey, userId);

    if (
      oldRank !== null &&
      !(await this.redis.exists(this.heartbeatKey(eventId, userId)))
    ) {
      await this.redis.zrem(queueKey, userId);
    }
    // Xếp hàng vào Redis Sorted Set với điểm số là thời điểm gia nhập
    let rank = await this.redis.zrank(queueKey, userId);
    if (rank === null) {
      await this.redis.zadd(queueKey, Date.now(), userId);
      rank = await this.redis.zrank(queueKey, userId);
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

    if (!event.isWaitingRoomEnabled) {
      const admissionToken = await this.generateAdmissionToken(userId, eventId);
      return { status: "ADMITTED", admissionToken };
    }

    const activeKey = `active_users:${eventId}`;
    const queueKey = `waiting_room:${eventId}`;

    const isAlreadyActive = await this.redis.sismember(activeKey, userId);

    if (isAlreadyActive) {
      const alive = await this.redis.exists(this.heartbeatKey(eventId, userId));

      if (!alive) {
        await this.redis.srem(activeKey, userId);
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
      this.redis.scard(activeKey),
      this.redis.zrank(queueKey, userId),
    ]);

    if (rank === null) {
      // Chưa có trong hàng chờ, gọi joinQueue
      return this.joinQueue(userId, eventId);
    }

    const heartbeatAlive = await this.redis.exists(
      this.heartbeatKey(eventId, userId),
    );

    if (!heartbeatAlive) {
      await this.redis.zrem(queueKey, userId);
      return this.joinQueue(userId, eventId);
    }

    await this.touchHeartbeat(eventId, userId);

    // Nếu đứng đầu hàng chờ và còn chỗ trống -> Nhận vào (promote)
    if (rank === 0 && activeCount < event.maxActiveUsers) {
      await Promise.all([
        this.redis.zrem(queueKey, userId),
        this.redis.sadd(activeKey, userId),
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
    await this.redis.srem(`active_users:${eventId}`, userId);
    await this.redis.del(this.heartbeatKey(eventId, userId));
  }
}
