import {
  ConflictException,
  ForbiddenException,
  NotFoundException,
  UnauthorizedException,
} from "@nestjs/common";
import { IdentityDomainError } from "../domain/identity.errors";

/** Giu nguyen dinh dang loi cu: { success, error: { code, message, timestamp } }. */
export async function mapIdentityErrors<T>(work: () => Promise<T>): Promise<T> {
  try {
    return await work();
  } catch (err) {
    if (!(err instanceof IdentityDomainError)) throw err;
    const body = {
      success: false,
      error: {
        code: err.code,
        message: err.message,
        timestamp: new Date().toISOString(),
      },
    };
    switch (err.kind) {
      case "CONFLICT":
        throw new ConflictException(body);
      case "FORBIDDEN":
        throw new ForbiddenException(body);
      case "NOT_FOUND":
        throw new NotFoundException(body);
      default:
        throw new UnauthorizedException(body);
    }
  }
}
