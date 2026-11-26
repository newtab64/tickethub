import type Redis from "ioredis";
import { VenueCommands } from "./application/venue-commands.service";
import { VenueQueries } from "./application/venue-queries.service";
import type { VenueReadCache, VenueRepository } from "./domain/venue.ports";
import { DrizzleVenueRepository } from "./infrastructure/drizzle-venue.repository";
import { RedisVenueCache } from "./infrastructure/redis-venue.cache";

export function createVenueServices(
  redis: Redis,
  overrides: { repo?: VenueRepository; cache?: VenueReadCache } = {},
) {
  const repo = overrides.repo ?? new DrizzleVenueRepository();
  const cache = overrides.cache ?? new RedisVenueCache(redis);
  return {
    queries: new VenueQueries(repo, cache),
    commands: new VenueCommands(repo, cache),
  };
}
