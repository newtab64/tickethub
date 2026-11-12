import { randomUUID } from "node:crypto";
import type { JwtService } from "@nestjs/jwt";
import { env } from "../../../config/env.config";
import type { TokenService } from "../domain/identity.ports";

export class JwtTokenService implements TokenService {
  constructor(private readonly jwt: JwtService) {}

  signAccessToken(user: { id: string; email: string; role: string }) {
    return this.jwt.signAsync(
      { sub: user.id, email: user.email, role: user.role },
      { secret: env.JWT_SECRET, expiresIn: 900 },
    );
  }

  signRefreshToken(userId: string) {
    return this.jwt.signAsync(
      { sub: userId, tokenType: "refresh", jti: randomUUID() },
      { secret: env.JWT_SECRET, expiresIn: 604800 },
    );
  }

  signEmailVerificationToken(userId: string) {
    return this.jwt.signAsync(
      { sub: userId, type: "email_verification" },
      { secret: env.JWT_SECRET, expiresIn: 86400 },
    );
  }

  verify<T extends object>(token: string): Promise<T> {
    return this.jwt.verifyAsync<T>(token, { secret: env.JWT_SECRET });
  }
}
