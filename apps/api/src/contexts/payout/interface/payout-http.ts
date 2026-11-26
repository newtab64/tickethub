import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from "@nestjs/common";
import { PayoutDomainError } from "../domain/payout.errors";

/** Giu nguyen hop dong loi cu: chuoi "CODE: mo ta" hoac { success, error } khi structured. */
export async function mapPayoutErrors<T>(work: () => Promise<T>): Promise<T> {
  try {
    return await work();
  } catch (err) {
    if (!(err instanceof PayoutDomainError)) throw err;
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
      case "FORBIDDEN":
        throw new ForbiddenException(body);
      default:
        throw new BadRequestException(body);
    }
  }
}
