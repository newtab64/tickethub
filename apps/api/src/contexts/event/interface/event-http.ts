import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from "@nestjs/common";
import { EventDomainError } from "../domain/event.errors";

/** Giu nguyen dinh dang loi cu: { success, error: { code, message, timestamp } }. */
export async function mapEventErrors<T>(work: () => Promise<T>): Promise<T> {
  try {
    return await work();
  } catch (err) {
    if (!(err instanceof EventDomainError)) throw err;
    const body = err.plainMessage
      ? err.message
      : {
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
      case "FORBIDDEN":
        throw new ForbiddenException(body);
      case "CONFLICT":
        throw new ConflictException(body);
      default:
        throw new BadRequestException(body);
    }
  }
}
