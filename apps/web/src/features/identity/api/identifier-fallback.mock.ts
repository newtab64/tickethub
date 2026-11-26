// Du lieu gia cho buoc kiem tra tai khoan: do tre mang, loi mang, gioi han tan suat va
// danh sach tai khoan mau. Chi dung de phat trien khi backend chua san sang; hanh vi nay
// giu nguyen tu truoc khi tai cau truc (xem docs/ARCHITECTURE.md, muc du lieu tam).
import type { CheckIdentifierResult } from "./auth-api";
import { AuthNetworkError, AuthRateLimitError } from "./auth-errors";

/** Gia lap do tre va cac loi dac biet dua tren dinh danh nhap vao (da chuan hoa). */
export async function simulateIdentifierEdgeCases(
  identifier: string,
): Promise<void> {
  // Mock network latency (150ms)
  await new Promise((resolve) => setTimeout(resolve, 150));

  // Mock edge case: Network error
  if (
    identifier === "error@example.com" ||
    identifier === "network-error@example.com" ||
    identifier.startsWith("error")
  ) {
    throw new AuthNetworkError(
      "Không thể kết nối đến máy chủ xác thực. Vui lòng kiểm tra mạng và thử lại.",
    );
  }

  // Mock edge case: Rate limit (429)
  if (
    identifier === "ratelimit@example.com" ||
    identifier === "429@example.com" ||
    identifier.startsWith("429")
  ) {
    throw new AuthRateLimitError(
      "Bạn thao tác quá nhanh. Vui lòng thử lại sau ít phút",
      30,
    );
  }
}

/** Ket qua du phong khi endpoint kiem tra tai khoan khong kha dung. */
export function fallbackIdentifierResult(
  identifier: string,
): CheckIdentifierResult {
  // Mock existing accounts fallback (supports both .vn and .com domains)
  const knownExisting = [
    "buyer@tickethub.vn",
    "organizer@tickethub.vn",
    "admin@tickethub.vn",
    "staff@tickethub.vn",
    "buyer@tickethub.com",
    "organizer@tickethub.com",
    "admin@tickethub.com",
    "staff@tickethub.com",
    "nguyenan@example.com",
    "existing@example.com",
  ];

  const exists =
    knownExisting.includes(identifier) ||
    identifier.startsWith("demo") ||
    identifier.endsWith("@existing.com") ||
    identifier.endsWith("@tickethub.com") ||
    identifier.endsWith("@tickethub.vn");

  return {
    exists,
    methods: ["password"],
  };
}
