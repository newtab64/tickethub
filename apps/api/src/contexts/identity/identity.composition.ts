import type { JwtService } from "@nestjs/jwt";
import type { IdentityUseCases } from "./application/identity-use-cases";
import {
  CheckIdentifierUseCase,
  GetCurrentUserUseCase,
  LoginUseCase,
  RefreshSessionUseCase,
  RegisterUserUseCase,
  VerifyEmailUseCase,
} from "./application/identity.use-cases";
import type {
  PasswordHasher,
  TokenService,
  UserRepository,
} from "./domain/identity.ports";
import { Argon2PasswordHasher } from "./infrastructure/argon2-password.hasher";
import { DrizzleUserRepository } from "./infrastructure/drizzle-user.repository";
import { JwtTokenService } from "./infrastructure/jwt-token.service";

export function createIdentityUseCases(
  jwt: JwtService,
  overrides: {
    users?: UserRepository;
    hasher?: PasswordHasher;
    tokens?: TokenService;
  } = {},
): IdentityUseCases {
  const users = overrides.users ?? new DrizzleUserRepository();
  const hasher = overrides.hasher ?? new Argon2PasswordHasher();
  const tokens = overrides.tokens ?? new JwtTokenService(jwt);
  return {
    hasher,
    checkIdentifier: new CheckIdentifierUseCase(users),
    register: new RegisterUserUseCase(users, hasher, tokens),
    verifyEmail: new VerifyEmailUseCase(users, tokens),
    login: new LoginUseCase(users, hasher, tokens),
    refresh: new RefreshSessionUseCase(users, tokens),
    currentUser: new GetCurrentUserUseCase(users),
  };
}
