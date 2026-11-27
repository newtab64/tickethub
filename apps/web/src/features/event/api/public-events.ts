import { PublicEventSchema, type PublicEvent } from "@tickethub/shared";

const LOAD_ERROR = "Không tải được sự kiện. Vui lòng thử lại.";

/** Doc su kien dang mo ban theo slug hoac UUID; null khi khong ton tai. */
export async function fetchPublicEvent(
  identifier: string,
): Promise<PublicEvent | null> {
  // Doc luc goi: API_URL chi co o may chu, trinh duyet dung NEXT_PUBLIC_API_URL.
  const base =
    process.env.API_URL ||
    process.env.NEXT_PUBLIC_API_URL ||
    "http://localhost:4000/api/v1";
  try {
    const response = await fetch(
      `${base}/events/${encodeURIComponent(identifier)}`,
      { cache: "no-store", signal: AbortSignal.timeout(8000) },
    );
    if (response.status === 404) return null;
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return PublicEventSchema.parse((await response.json())?.data);
  } catch (cause) {
    throw new Error(LOAD_ERROR, { cause });
  }
}
