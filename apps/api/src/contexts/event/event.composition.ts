import type Redis from "ioredis";
import { EventReadModel } from "./application/event-read-model";
import { OrganizerEventService } from "./application/organizer-event.service";
import { PublicEventService } from "./application/public-event.service";
import type {
  EventReadRepository,
  EventRepository,
  OrganizerProfileLookup,
  ReadCache,
} from "./domain/event.ports";
import {
  DrizzleEventReadRepository,
  DrizzleEventRepository,
  DrizzleOrganizerProfileLookup,
} from "./infrastructure/drizzle-event.repository";
import { RedisReadCache } from "./infrastructure/redis-read-cache";

export function createEventServices(
  redis: Redis,
  overrides: {
    events?: EventRepository;
    profiles?: OrganizerProfileLookup;
    reader?: EventReadRepository;
    cache?: ReadCache;
  } = {},
) {
  const events = overrides.events ?? new DrizzleEventRepository();
  const profiles = overrides.profiles ?? new DrizzleOrganizerProfileLookup();
  const reader = overrides.reader ?? new DrizzleEventReadRepository();
  const cache = overrides.cache ?? new RedisReadCache(redis);
  return {
    organizer: new OrganizerEventService(events, profiles),
    publicEvents: new PublicEventService(events),
    readModel: new EventReadModel(cache, reader),
  };
}

/** Chi lap rap dich vu Ban to chuc (khong can Redis), dung cho test va script. */
export function createOrganizerEventService(
  overrides: {
    events?: EventRepository;
    profiles?: OrganizerProfileLookup;
  } = {},
) {
  return new OrganizerEventService(
    overrides.events ?? new DrizzleEventRepository(),
    overrides.profiles ?? new DrizzleOrganizerProfileLookup(),
  );
}
