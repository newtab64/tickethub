import { NotFoundException } from "@nestjs/common";
import { VenueDomainError } from "../domain/venue.errors";

/** Giu nguyen dinh dang loi cu: { success, error: { code, message, timestamp } }. */
export async function mapVenueErrors<T>(work: () => Promise<T>): Promise<T> {
  try {
    return await work();
  } catch (err) {
    if (err instanceof VenueDomainError) {
      throw new NotFoundException({
        success: false,
        error: {
          code: err.code,
          message: err.message,
          timestamp: new Date().toISOString(),
        },
      });
    }
    throw err;
  }
}
