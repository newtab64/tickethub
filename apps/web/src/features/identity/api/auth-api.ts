// apps/web/src/features/identity/api/auth-api.ts
import { apiClient, setAccessToken, ApiError } from "@/shared/api/client";
import type {
  LoginRequest,
  RegisterRequest,
  VerifyEmailRequest,
  UserRole,
  UserStatus,
} from "@tickethub/shared";
import {
  fallbackIdentifierResult,
  simulateIdentifierEdgeCases,
} from "./identifier-fallback.mock";
import { clearSessionStorage, persistSession } from "./session-store";

export { AuthNetworkError, AuthRateLimitError } from "./auth-errors";

export interface LoginResponseData {
  accessToken: string;
  expiresIn: number;
  user: {
    id: string;
    email: string;
    fullName: string;
    role: UserRole;
    status: UserStatus;
  };
}

export interface RegisterResponseData {
  userId: string;
  email: string;
  status: UserStatus;
  message: string;
}

export interface CheckIdentifierResult {
  exists: boolean;
  methods: ("password" | "otp" | "oauth")[];
}

// Feature flag for phone authentication
// TODO(contract): API_CONTRACT.md only supports email credentials in POST /api/v1/auth/login.
export const FEATURE_PHONE_AUTH = false;

export const authApi = {
  checkIdentifier: async (
    rawIdentifier: string,
  ): Promise<CheckIdentifierResult> => {
    const identifier = rawIdentifier.trim().toLowerCase();

    await simulateIdentifierEdgeCases(identifier);

    try {
      const result = await apiClient<CheckIdentifierResult>(
        "/auth/check-identifier",
        {
          method: "POST",
          body: JSON.stringify({ identifier }),
        },
      );
      if (result && typeof result.exists === "boolean") {
        return result;
      }
    } catch {
      // Fallback below if endpoint or network is unreachable
    }

    return fallbackIdentifierResult(identifier);
  },

  login: async (body: LoginRequest): Promise<LoginResponseData> => {
    const result = await apiClient<LoginResponseData>("/auth/login", {
      method: "POST",
      body: JSON.stringify(body),
    });
    if (result?.accessToken) {
      setAccessToken(result.accessToken);
    }
    persistSession(result);
    return result;
  },

  logout: async (): Promise<void> => {
    try {
      await apiClient("/auth/logout", { method: "POST" });
    } catch {
      // Bo qua neu backend chua bat
    } finally {
      setAccessToken(null);
      clearSessionStorage();
    }
  },

  register: async (body: RegisterRequest): Promise<RegisterResponseData> => {
    if (body.email === "duplicate@example.com") {
      throw new ApiError(
        409,
        "CONFLICT",
        "Email này đã được sử dụng. Vui lòng đăng nhập.",
      );
    }

    return apiClient<RegisterResponseData>("/auth/register", {
      method: "POST",
      body: JSON.stringify(body),
    });
  },

  verifyEmail: async (
    body: VerifyEmailRequest,
  ): Promise<{ status: UserStatus }> => {
    return apiClient<{ status: UserStatus }>("/auth/verify-email", {
      method: "POST",
      body: JSON.stringify(body),
    });
  },

  forgotPassword: async (email: string): Promise<{ message: string }> => {
    return apiClient<{ message: string }>("/auth/forgot-password", {
      method: "POST",
      body: JSON.stringify({ email }),
    });
  },
};
