// API cong khai cua feature identity (chi cac thanh phan phia client an toan de import)
export { SessionProvider, useSession } from "./ui/session-provider";
export type { AuthUser, SessionContextValue } from "./ui/session-provider";
export { AuthProvider, useAuthContext } from "./ui/auth-context";
export type { RoleTab } from "./ui/auth-context";
export { AuthLayout } from "./ui/auth-layout";
export { AuthPage } from "./ui/auth-page";
export { ForgotPasswordPage } from "./ui/forgot-password-page";
export { VerifyEmailPage } from "./ui/verify-email-page";
export { authApi } from "./api/auth-api";
export type {
  LoginResponseData,
  RegisterResponseData,
  CheckIdentifierResult,
} from "./api/auth-api";
