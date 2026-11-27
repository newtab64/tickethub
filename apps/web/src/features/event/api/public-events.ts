import { PublicEventSchema, type PublicEvent } from "@tickethub/shared";

const LOAD_ERROR = "Không tải được sự kiện. Vui lòng thử lại.";

/** Goi API cong khai; null khi 404, moi loi khac thanh mot thong diep chung. */
async function read<T>(
  path: string,
  parse: (data: unknown) => T,
): Promise<T | null> {
  // Doc luc goi: API_URL chi co o may chu, trinh duyet dung NEXT_PUBLIC_API_URL.
  const base =
    process.env.API_URL ||
    process.env.NEXT_PUBLIC_API_URL ||
    "http://localhost:4000/api/v1";
  try {
    const response = await fetch(`${base}${path}`, {
      cache: "no-store",
      signal: AbortSignal.timeout(8000),
    });
    if (response.status === 404) return null;
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return parse((await response.json())?.data);
  } catch (cause) {
    throw new Error(LOAD_ERROR, { cause });
  }
}

/** Doc su kien dang mo ban theo slug hoac UUID; null khi khong ton tai. */
export function fetchPublicEvent(
  identifier: string,
): Promise<PublicEvent | null> {
  return read(`/events/${encodeURIComponent(identifier)}`, (data) =>
    PublicEventSchema.parse(data),
  );
}

/** Danh sach su kien dang mo ban (toi da 50); bo qua rieng muc sai du lieu. */
export async function fetchPublicEvents(): Promise<PublicEvent[]> {
  const events = await read("/events?limit=50", (data) => {
    const items = (data as { items?: unknown } | undefined)?.items;
    if (!Array.isArray(items)) throw new Error("Missing items");
    return items.flatMap((item) => {
      const parsed = PublicEventSchema.safeParse(item);
      if (parsed.success) return [parsed.data];
      console.warn("Bỏ qua sự kiện sai dữ liệu", parsed.error.issues);
      return [];
    });
  });
  if (!events) throw new Error(LOAD_ERROR);
  return events;
}
