import { Module } from "@nestjs/common";
import type Redis from "ioredis";
import { REDIS_CLIENT } from "../../database/redis.module";
import { IdentityModule } from "../identity/identity.module";
import { EventReadModel } from "./application/event-read-model";
import { OrganizerEventService } from "./application/organizer-event.service";
import { PublicEventService } from "./application/public-event.service";
import { createEventServices } from "./event.composition";
import {
  OrganizerEventsController,
  PublicEventsController,
} from "./interface/events.controller";
import { SeatStreamService } from "./infrastructure/seat-stream.service";

const EVENT_SERVICES = Symbol("EVENT_SERVICES");
type EventServices = ReturnType<typeof createEventServices>;

@Module({
  imports: [IdentityModule],
  controllers: [OrganizerEventsController, PublicEventsController],
  providers: [
    {
      provide: EVENT_SERVICES,
      useFactory: (redis: Redis) => createEventServices(redis),
      inject: [REDIS_CLIENT],
    },
    {
      provide: OrganizerEventService,
      useFactory: (s: EventServices) => s.organizer,
      inject: [EVENT_SERVICES],
    },
    {
      provide: PublicEventService,
      useFactory: (s: EventServices) => s.publicEvents,
      inject: [EVENT_SERVICES],
    },
    {
      provide: EventReadModel,
      useFactory: (s: EventServices) => s.readModel,
      inject: [EVENT_SERVICES],
    },
    SeatStreamService,
  ],
  exports: [EventReadModel, SeatStreamService],
})
export class EventModule {}
