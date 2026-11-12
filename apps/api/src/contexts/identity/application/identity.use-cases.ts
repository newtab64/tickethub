import {
  UserStatus,
  type LoginRequest,
  type RegisterRequest,
} from "@tickethub/shared";
import { identityErrors } from "../domain/identity.errors";
import {
  ACCESS_TOKEN_TTL_SECONDS,
  type PasswordHasher,
  type TokenService,
  type UserRepository,
} from "../domain/identity.ports";
import {
  assertNotTemporarilyLocked,
  assertStatusAllowsLogin,
  failureError,
  hasLoginFailureState,
  normalizeEmail,
  registerFailedAttempt,
} from "../domain/login-policy";
import type { RegisteredUser } from "../domain/user.models";

const REGISTER_MESSAGE =
  "Liên kết kích hoạt đã được gửi tới email của bạn (hiệu lực 24 giờ).";

export class CheckIdentifierUseCase {
  constructor(private readonly users: UserRepository) {}

  async execute(identifier: string): Promise<boolean> {
    const email = normalizeEmail(identifier);
    if (!email) return false;
    return Boolean(await this.users.findByEmail(email));
  }
}

export class RegisterUserUseCase {
  constructor(
    private readonly users: UserRepository,
    private readonly hasher: PasswordHasher,
    private readonly tokens: TokenService,
  ) {}

  async execute(dto: RegisterRequest): Promise<RegisteredUser> {
    const email = normalizeEmail(dto.email);
    if (await this.users.findByEmail(email)) {
      throw identityErrors.emailAlreadyExists();
    }

    const passwordHash = await this.hasher.hash(dto.password);
    const { user, verificationToken } =
      await this.users.createPendingWithOutbox(
        {
          email,
          passwordHash,
          fullName: dto.fullName.trim(),
          phone: dto.phone,
          role: dto.role,
        },
        (userId) => this.tokens.signEmailVerificationToken(userId),
      );

    return {
      userId: user.id,
      email: user.email,
      status: user.status,
      verificationToken,
      message: REGISTER_MESSAGE,
    };
  }
}

export class VerifyEmailUseCase {
  constructor(
    private readonly users: UserRepository,
    private readonly tokens: TokenService,
  ) {}

  async execute(token: string): Promise<{ status: UserStatus }> {
    let payload: { sub: string; type: string };
    try {
      payload = await this.tokens.verify(token);
    } catch {
      throw identityErrors.invalidVerificationToken();
    }
    if (payload.type !== "email_verification") {
      throw identityErrors.notEmailVerificationToken();
    }

    const user = await this.users.findById(payload.sub);
    if (!user) throw identityErrors.userNotFound();

    if (user.status !== UserStatus.ACTIVE) {
      await this.users.activate(user.id, new Date());
    }
    return { status: UserStatus.ACTIVE };
  }
}

export class LoginUseCase {
  constructor(
    private readonly users: UserRepository,
    private readonly hasher: PasswordHasher,
    private readonly tokens: TokenService,
  ) {}

  async execute(dto: LoginRequest) {
    const user = await this.users.findByEmail(normalizeEmail(dto.email));
    if (!user) throw identityErrors.invalidCredentials();

    const now = new Date();
    assertNotTemporarilyLocked(user, now);

    const matches = await this.hasher.verify(user.passwordHash, dto.password);
    if (!matches) {
      const outcome = registerFailedAttempt(user, now);
      await this.users.recordFailedLogin(
        user.id,
        outcome.attempts,
        outcome.lockedUntil,
        now,
      );
      throw failureError(outcome);
    }

    assertStatusAllowsLogin(user);

    if (hasLoginFailureState(user)) {
      await this.users.resetLoginFailures(user.id, new Date());
    }

    const accessToken = await this.tokens.signAccessToken(user);
    const refreshToken = await this.tokens.signRefreshToken(user.id);

    return {
      accessToken,
      refreshToken,
      expiresIn: ACCESS_TOKEN_TTL_SECONDS,
      user: {
        id: user.id,
        email: user.email,
        fullName: user.fullName,
        role: user.role,
        status: user.status,
      },
    };
  }
}

export class RefreshSessionUseCase {
  constructor(
    private readonly users: UserRepository,
    private readonly tokens: TokenService,
  ) {}

  async execute(oldRefreshToken: string) {
    let payload: { sub: string; tokenType: string };
    try {
      payload = await this.tokens.verify(oldRefreshToken);
    } catch {
      throw identityErrors.invalidRefreshToken();
    }
    if (payload.tokenType !== "refresh") throw identityErrors.notRefreshToken();

    const user = await this.users.findById(payload.sub);
    if (!user || user.status !== UserStatus.ACTIVE) {
      throw identityErrors.userInactive();
    }

    return {
      accessToken: await this.tokens.signAccessToken(user),
      refreshToken: await this.tokens.signRefreshToken(user.id),
      expiresIn: ACCESS_TOKEN_TTL_SECONDS,
    };
  }
}

export class GetCurrentUserUseCase {
  constructor(private readonly users: UserRepository) {}

  async execute(userId: string) {
    const user = await this.users.findById(userId);
    if (!user) throw identityErrors.profileNotFound();
    return {
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      phone: user.phone,
      role: user.role,
      status: user.status,
      emailVerifiedAt: user.emailVerifiedAt,
    };
  }
}
