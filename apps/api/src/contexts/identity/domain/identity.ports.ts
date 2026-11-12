import type { NewUser, User } from "./user.models";

export interface UserRepository {
  findByEmail(email: string): Promise<User | null>;
  findById(id: string): Promise<User | null>;
  /**
   * Tao tai khoan PENDING_EMAIL va ghi outbox USER_REGISTERED trong cung mot
   * transaction. `buildVerificationToken` duoc goi voi id vua tao.
   */
  createPendingWithOutbox(
    input: NewUser,
    buildVerificationToken: (userId: string) => Promise<string>,
  ): Promise<{ user: User; verificationToken: string }>;
  activate(userId: string, at: Date): Promise<void>;
  recordFailedLogin(
    userId: string,
    attempts: number,
    lockedUntil: Date | null,
    at: Date,
  ): Promise<void>;
  resetLoginFailures(userId: string, at: Date): Promise<void>;
}

export interface PasswordHasher {
  hash(password: string): Promise<string>;
  verify(hash: string, password: string): Promise<boolean>;
}

export interface TokenService {
  signAccessToken(user: {
    id: string;
    email: string;
    role: string;
  }): Promise<string>;
  signRefreshToken(userId: string): Promise<string>;
  signEmailVerificationToken(userId: string): Promise<string>;
  /** Nem loi neu token sai chu ky hoac het han. */
  verify<T extends object>(token: string): Promise<T>;
}

export const ACCESS_TOKEN_TTL_SECONDS = 900;
