"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useAuthContext } from "./auth-context";
import { useSession } from "./session-provider";
import { authApi, AuthNetworkError, AuthRateLimitError } from "../api/auth-api";
import { ApiError } from "@/shared/api/client";
import {
  identifierSchema,
  passwordSchema,
  registerSchema,
  resolveActiveStep,
  resolvePostLoginRedirect,
  isRegistrationConflict,
  type AuthStep,
  type IdentifierInput,
  type PasswordInput,
  type RegisterInput,
} from "../domain/auth-flow";

/** Trang thai va hanh dong cua luong xac thuc 3 buoc (email, mat khau, dang ky). */
export function useAuthFlow() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const stepParam = searchParams.get("step");

  const { identifier, setIdentifier, roleTab, setRoleTab } = useAuthContext();
  const { login: sessionLogin } = useSession();

  // Active step calculation: If no identifier in memory, gracefully default to "identifier" step
  const activeStep: AuthStep = resolveActiveStep(stepParam, identifier);

  // Screen-reader announcement
  const [announcement, setAnnouncement] = useState("");

  // Step 1 State
  const [step1Error, setStep1Error] = useState<string | null>(null);
  const [step1NetworkError, setStep1NetworkError] = useState(false);
  const [rateLimitTimer, setRateLimitTimer] = useState<number | null>(null);

  // Step 2a (Password) State
  const [showPassword, setShowPassword] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);
  // TODO(contract): POST /api/v1/auth/login lacks rememberMe option; state handled on client.
  const [rememberMe, setRememberMe] = useState(false);

  // Step 2b (Register) State
  const [registerError, setRegisterError] = useState<string | null>(null);

  // Refs for auto-focusing
  const identifierInputRef = useRef<HTMLInputElement>(null);
  const passwordInputRef = useRef<HTMLInputElement>(null);
  const fullNameInputRef = useRef<HTMLInputElement>(null);

  // Forms
  const {
    register: registerId,
    handleSubmit: handleIdSubmit,
    setValue: setIdValue,
    getValues: getValuesId,
    formState: { errors: idErrors, isSubmitting: isCheckingId },
  } = useForm<IdentifierInput>({
    resolver: zodResolver(identifierSchema),
    defaultValues: { identifier },
  });

  const {
    register: registerPass,
    handleSubmit: handlePassSubmit,
    setValue: setPassValue,
    formState: { errors: passErrors, isSubmitting: isLoggingIn },
  } = useForm<PasswordInput>({
    resolver: zodResolver(passwordSchema),
    defaultValues: { password: "" },
  });

  const {
    register: registerReg,
    handleSubmit: handleRegSubmit,
    watch: watchReg,
    formState: { errors: regErrors, isSubmitting: isRegistering },
  } = useForm<RegisterInput>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      fullName: "",
      organizationName: "",
      password: "",
    },
  });

  // eslint-disable-next-line react-hooks/incompatible-library -- React Hook Form watch is intentional to preserve component runtime behavior
  const watchedPassword = watchReg("password");

  // Keep form value in sync when returning with prefilled identifier
  useEffect(() => {
    if (identifier) {
      setIdValue("identifier", identifier);
    }
  }, [identifier, setIdValue]);

  // Rate-limit countdown timer
  useEffect(() => {
    if (rateLimitTimer === null || rateLimitTimer <= 0) return;
    const interval = setInterval(() => {
      setRateLimitTimer((prev) => (prev && prev > 1 ? prev - 1 : null));
    }, 1000);
    return () => clearInterval(interval);
  }, [rateLimitTimer]);

  // Auto-focus on active step transition
  useEffect(() => {
    if (activeStep === "identifier") {
      setAnnouncement("Bước 1: Nhập email tài khoản");
      setTimeout(() => {
        identifierInputRef.current?.focus();
        if (identifier) {
          identifierInputRef.current?.select();
        }
      }, 50);
    } else if (activeStep === "password") {
      setAnnouncement("Bước 2: Nhập mật khẩu đăng nhập");
      setTimeout(() => {
        passwordInputRef.current?.focus();
      }, 50);
    } else if (activeStep === "register") {
      setAnnouncement("Bước 2: Điền thông tin tạo tài khoản");
      setTimeout(() => {
        fullNameInputRef.current?.focus();
      }, 50);
    }
  }, [activeStep, identifier]);

  // Return to step 1
  const handleBackToIdentifier = () => {
    setLoginError(null);
    setRegisterError(null);
    setStep1Error(null);
    setPassValue("password", "");
    router.push("/auth");
  };

  // Step 1: Submit Identifier
  const onIdentifierSubmit = async (data: IdentifierInput) => {
    setStep1Error(null);
    setStep1NetworkError(false);
    const cleanId = data.identifier.trim();

    try {
      const result = await authApi.checkIdentifier(cleanId);
      setIdentifier(cleanId);

      if (result.exists) {
        router.push("/auth?step=password");
      } else {
        router.push("/auth?step=register");
      }
    } catch (err) {
      if (err instanceof AuthRateLimitError) {
        setStep1Error(err.message);
        setRateLimitTimer(err.retryAfter);
      } else if (err instanceof AuthNetworkError) {
        setStep1Error(err.message);
        setStep1NetworkError(true);
      } else {
        setStep1Error(
          "Không thể kiểm tra tài khoản lúc này. Vui lòng thử lại sau.",
        );
        setStep1NetworkError(true);
      }
    }
  };

  // Step 2a: Submit Password
  const onPasswordSubmit = async (data: PasswordInput) => {
    setLoginError(null);
    try {
      const result = await authApi.login({
        email: identifier,
        password: data.password,
      });

      if (result) {
        sessionLogin(result);
      }

      router.push(
        resolvePostLoginRedirect(
          searchParams.get("redirect"),
          result?.user?.role,
        ),
      );
    } catch (err) {
      if (err instanceof ApiError) {
        setLoginError(err.message);
      } else {
        setLoginError("Mật khẩu không chính xác. Vui lòng kiểm tra lại.");
      }
      setTimeout(() => {
        passwordInputRef.current?.focus();
        passwordInputRef.current?.select();
      }, 50);
    }
  };

  // Step 2b: Submit Register
  const onRegisterSubmit = async (data: RegisterInput) => {
    setRegisterError(null);
    try {
      // TODO(contract): API_CONTRACT.md lacks organizationName; handled on frontend
      await authApi.register({
        email: identifier,
        password: data.password,
        fullName: data.fullName,
        role: roleTab,
      });
      router.push(`/verify-email?email=${encodeURIComponent(identifier)}`);
    } catch (err) {
      if (err instanceof ApiError) {
        // Edge Case: Registration Race (Account was created between check and submit)
        if (isRegistrationConflict(err.status, err.message)) {
          router.push("/auth?step=password");
          setLoginError("Tài khoản đã tồn tại. Hãy đăng nhập.");
          return;
        }
        setRegisterError(err.message);
      } else {
        setRegisterError(
          "Không thể tạo tài khoản lúc này. Vui lòng thử lại sau.",
        );
      }
    }
  };

  return {
    activeStep,
    announcement,
    identifier,
    roleTab,
    setRoleTab,
    step1Error,
    step1NetworkError,
    rateLimitTimer,
    showPassword,
    setShowPassword,
    loginError,
    rememberMe,
    setRememberMe,
    registerError,
    identifierInputRef,
    passwordInputRef,
    fullNameInputRef,
    registerId,
    handleIdSubmit,
    getValuesId,
    idErrors,
    isCheckingId,
    registerPass,
    handlePassSubmit,
    passErrors,
    isLoggingIn,
    registerReg,
    handleRegSubmit,
    regErrors,
    isRegistering,
    watchedPassword,
    handleBackToIdentifier,
    onIdentifierSubmit,
    onPasswordSubmit,
    onRegisterSubmit,
  };
}

export type AuthFlow = ReturnType<typeof useAuthFlow>;
