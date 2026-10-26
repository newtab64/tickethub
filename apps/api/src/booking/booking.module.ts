import { Module } from "@nestjs/common";
import { BookingController } from "./booking.controller";
import { BookingService } from "./booking.service";
import { BookingCleanupTask } from "./booking-cleanup.task";
import { AuthModule } from "../auth/auth.module";
import { WaitingRoomModule } from "../waiting-room/waiting-room.module";
import { EventsModule } from "../events/events.module";
@Module({
  imports: [AuthModule, WaitingRoomModule, EventsModule],
  controllers: [BookingController],
  providers: [BookingService, BookingCleanupTask],
  exports: [BookingService],
})
export class BookingModule {}
