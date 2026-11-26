import { Logger } from "@nestjs/common";
import type Redis from "ioredis";
import { venueCacheKeys } from "../domain/venue-cache-keys";
import type { VenueReadCache } from "../domain/venue.ports";

export class RedisVenueCache implements VenueReadCache {
  private readonly logger = new Logger(RedisVenueCache.name);

  constructor(private readonly redis: Redis) {}

  async get<T>(key: string): Promise<T | null> {
    try {
      const cached = await this.redis.get(key);
      return cached ? (JSON.parse(cached) as T) : null;
    } catch (err) {
      this.logger.warn(`Redis get error: ${(err as Error).message}`);
      return null;
    }
  }

  async set(key: string, value: unknown, ttlSeconds: number): Promise<void> {
    try {
      await this.redis.set(key, JSON.stringify(value), "EX", ttlSeconds);
    } catch (err) {
      this.logger.warn(`Redis set error: ${(err as Error).message}`);
    }
  }

  async invalidate(venueId?: string): Promise<void> {
    try {
      const keys: string[] = [];
      if (venueId) {
        keys.push(
          venueCacheKeys.detail(venueId),
          venueCacheKeys.layouts(venueId),
        );
      }
      keys.push(...(await this.redis.keys(venueCacheKeys.listPattern)));
      if (keys.length > 0) await this.redis.del(...keys);
    } catch (err) {
      this.logger.warn(`Redis invalidate error: ${(err as Error).message}`);
    }
  }
}
