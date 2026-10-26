import { Module } from "@nestjs/common";
import { EventsService } from "./events.service";
import {
  OrganizerEventsController,
  PublicEventsController,
} from "./events.controller";
import { AuthModule } from "../auth/auth.module";
import { EventReadCacheService } from "./event-read-cache.service";
@Module({
  imports: [AuthModule],
  controllers: [OrganizerEventsController, PublicEventsController],
  providers: [EventsService, EventReadCacheService],
  exports: [EventsService, EventReadCacheService],
})
export class EventsModule {}
