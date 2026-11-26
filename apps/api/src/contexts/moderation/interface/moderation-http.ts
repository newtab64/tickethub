import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from "@nestjs/common";
import { ModerationDomainError } from "../domain/moderation.errors";

/** Giu nguyen hop dong loi cu: { success, error } hoac chuoi "CODE: mo ta". */
export async function mapModerationErrors<T>(
  work: () => Promise<T>,
): Promise<T> {
  try {
    return await work();
  } catch (err) {
    if (!(err instanceof ModerationDomainError)) throw err;
    const body = err.structured
      ? {
          success: false,
          error: {
            code: err.code,
            message: err.message,
            timestamp: new Date().toISOString(),
          },
        }
      : err.message;
    switch (err.kind) {
      case "NOT_FOUND":
        throw new NotFoundException(body);
      case "CONFLICT":
        throw new ConflictException(body);
      default:
        throw new BadRequestException(body);
    }
  }
}
