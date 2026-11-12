import type {
  CheckIdentifierUseCase,
  GetCurrentUserUseCase,
  LoginUseCase,
  RefreshSessionUseCase,
  RegisterUserUseCase,
  VerifyEmailUseCase,
} from "./identity.use-cases";
import type { PasswordHasher } from "../domain/identity.ports";

/** Token DI de interface nhan bo use case cua Identity ma khong biet cach lap rap. */
export const IDENTITY_USE_CASES = Symbol("IDENTITY_USE_CASES");

export interface IdentityUseCases {
  hasher: PasswordHasher;
  checkIdentifier: CheckIdentifierUseCase;
  register: RegisterUserUseCase;
  verifyEmail: VerifyEmailUseCase;
  login: LoginUseCase;
  refresh: RefreshSessionUseCase;
  currentUser: GetCurrentUserUseCase;
}
