import { Logger } from "@nestjs/common";
import type Redis from "ioredis";
import type { ReadCache } from "../domain/event.ports";

export class RedisReadCache implements ReadCache {
  private readonly logger = new Logger(RedisReadCache.name);

  constructor(private readonly redis: Redis) {}

  async get<T>(key: string): Promise<T | null> {
    try {
      const raw = await this.redis.get(key);
      return raw !== null ? (JSON.parse(raw) as T) : null;
    } catch (error) {
      this.logger.warn(`Redis GET failed, using PostgreSQL: ${String(error)}`);
      return null;
    }
  }

  async set(key: string, value: unknown, ttlSeconds: number): Promise<void> {
    try {
      await this.redis.set(key, JSON.stringify(value), "EX", ttlSeconds);
    } catch (error) {
      this.logger.warn(`Redis SET failed: ${String(error)}`);
    }
  }

  async del(...keys: string[]): Promise<void> {
    try {
      await this.redis.del(...keys);
    } catch (error) {
      this.logger.warn(`Redis invalidation failed: ${String(error)}`);
    }
  }
}
