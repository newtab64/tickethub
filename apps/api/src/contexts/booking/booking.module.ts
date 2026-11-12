import { Module } from "@nestjs/common";
import { EventModule } from "../event/event.module";
import { EventReadModel } from "../event/application/event-read-model";
import { SeatStreamService } from "../event/infrastructure/seat-stream.service";
import { IdentityModule } from "../identity/identity.module";
import { BookingCommands } from "./application/booking-commands.service";
import { BookingQueries } from "./application/booking-queries.service";
import { BuyerOrderQueries } from "./application/buyer-order-queries.service";
import {
  createBookingCommands,
  createBookingQueries,
  createBuyerOrderQueries,
} from "./booking.composition";
import { BookingController } from "./interface/booking.controller";
import { BookingCleanupTask } from "./interface/booking-cleanup.task";
import { BuyerOrderController } from "./interface/buyer-order.controller";

@Module({
  imports: [IdentityModule, EventModule],
  controllers: [BookingController, BuyerOrderController],
  providers: [
    {
      provide: BookingCommands,
      useFactory: (cache: EventReadModel, stream?: SeatStreamService) =>
        createBookingCommands(cache, stream),
      inject: [EventReadModel, { token: SeatStreamService, optional: true }],
    },
    { provide: BookingQueries, useFactory: () => createBookingQueries() },
    { provide: BuyerOrderQueries, useFactory: () => createBuyerOrderQueries() },
    BookingCleanupTask,
  ],
  exports: [BookingCommands, BookingQueries, BuyerOrderQueries],
})
export class BookingModule {}
