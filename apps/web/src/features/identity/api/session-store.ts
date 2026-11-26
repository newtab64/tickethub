// Luu tru phien dang nhap phia trinh duyet: cookie accessToken va thong tin nguoi dung.
import type { LoginResponseData } from "./auth-api";

const USER_STORAGE_KEY = "tickethub_user";

function secureFlag(): string {
  return typeof window !== "undefined" && window.location.protocol === "https:"
    ? "; Secure"
    : "";
}

/** Ghi cookie accessToken (thoi han theo expiresIn) va luu nguoi dung vao localStorage. */
export function persistSession(result: LoginResponseData): void {
  if (typeof document === "undefined") return;
  const secure = secureFlag();
  const maxAge = result.expiresIn || 900;
  document.cookie = `accessToken=${result.accessToken}; path=/; max-age=${maxAge}; SameSite=Lax${secure}`;
  document.cookie = `th_role=; path=/; max-age=0; SameSite=Lax${secure}`;
  if (result?.user) {
    localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(result.user));
  }
}

/** Xoa cookie va thong tin nguoi dung da luu khi dang xuat. */
export function clearSessionStorage(): void {
  if (typeof document === "undefined") return;
  const secure = secureFlag();
  document.cookie = `accessToken=; path=/; max-age=0; SameSite=Lax${secure}`;
  document.cookie = `th_role=; path=/; max-age=0; SameSite=Lax${secure}`;
  localStorage.removeItem(USER_STORAGE_KEY);
}
