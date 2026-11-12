import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from "@nestjs/common";
import { BookingDomainError } from "../domain/booking.errors";

/** Giu nguyen dinh dang loi cu: { success, error: { code, message, timestamp } }. */
export async function mapBookingErrors<T>(work: () => Promise<T>): Promise<T> {
  try {
    return await work();
  } catch (err) {
    if (!(err instanceof BookingDomainError)) throw err;
    const body = {
      success: false,
      error: {
        code: err.code,
        message: err.message,
        timestamp: new Date().toISOString(),
      },
    };
    switch (err.kind) {
      case "NOT_FOUND":
        throw new NotFoundException(body);
      case "CONFLICT":
        throw new ConflictException(body);
      case "FORBIDDEN":
        throw new ForbiddenException(body);
      default:
        throw new BadRequestException(body);
    }
  }
}
