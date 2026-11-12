import { BookingCommands } from "./application/booking-commands.service";
import { BookingQueries } from "./application/booking-queries.service";
import { BuyerOrderQueries } from "./application/buyer-order-queries.service";
import type {
  BookingReader,
  BookingUnitOfWork,
  InventoryNotifier,
} from "./domain/booking.ports";
import type { BuyerOrderReader } from "./domain/buyer-order.ports";
import {
  DrizzleBookingReader,
  DrizzleBuyerOrderReader,
} from "./infrastructure/drizzle-booking.reader";
import { DrizzleBookingUnitOfWork } from "./infrastructure/drizzle-booking.unit-of-work";
import { EventInventoryNotifier } from "./infrastructure/event-inventory.notifier";

type NotifierDeps = ConstructorParameters<typeof EventInventoryNotifier>;

/** Lap rap lenh dat ve voi ha tang Drizzle that; `cache`/`seatStream` thuoc context Event. */
export function createBookingCommands(
  cache: NotifierDeps[0],
  seatStream?: NotifierDeps[1],
  overrides: {
    reader?: BookingReader;
    unitOfWork?: BookingUnitOfWork;
    notifier?: InventoryNotifier;
  } = {},
) {
  return new BookingCommands(
    overrides.reader ?? new DrizzleBookingReader(),
    overrides.unitOfWork ?? new DrizzleBookingUnitOfWork(),
    overrides.notifier ?? new EventInventoryNotifier(cache, seatStream),
  );
}

export function createBookingQueries(reader?: BookingReader) {
  return new BookingQueries(reader ?? new DrizzleBookingReader());
}

export function createBuyerOrderQueries(reader?: BuyerOrderReader) {
  return new BuyerOrderQueries(reader ?? new DrizzleBuyerOrderReader());
}
