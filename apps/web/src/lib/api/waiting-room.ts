// apps/web/src/lib/api/waiting-room.ts
import { apiClient } from "./client";

export interface WaitingRoomStatusResponse {
  status: "ADMITTED" | "QUEUED";
  admissionToken?: string;
  queuePosition?: number;
  estimatedWaitSeconds?: number;
  queueId?: string;
}

const ADMISSION_STORAGE_PREFIX = "tickethub:admission:";

export function saveAdmissionToken(eventId: string, token: string): void {
  if (typeof window === "undefined") return;
  try {
    const payload = {
      token,
      expiresAt: Date.now() + 10 * 60 * 1000, // 10 phút theo chuẩn BE1
    };
    sessionStorage.setItem(
      `${ADMISSION_STORAGE_PREFIX}${eventId}`,
      JSON.stringify(payload),
    );
  } catch {
    // Bỏ qua nếu trình duyệt chặn sessionStorage
  }
}

export function getAdmissionToken(eventId: string): string | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(`${ADMISSION_STORAGE_PREFIX}${eventId}`);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { token: string; expiresAt: number };
    if (Date.now() > parsed.expiresAt) {
      sessionStorage.removeItem(`${ADMISSION_STORAGE_PREFIX}${eventId}`);
      return null;
    }
    return parsed.token;
  } catch {
    return null;
  }
}

export const waitingRoomApi = {
  /**
   * POST /api/v1/waiting-room/:eventId/join
   */
  joinQueue: async (eventId: string): Promise<WaitingRoomStatusResponse> => {
    const result = await apiClient<WaitingRoomStatusResponse>(
      `/waiting-room/${encodeURIComponent(eventId)}/join`,
      { method: "POST" },
    );
    if (result.status === "ADMITTED" && result.admissionToken) {
      saveAdmissionToken(eventId, result.admissionToken);
    }
    return result;
  },

  /**
   * POST /api/v1/waiting-room/:eventId/heartbeat (Chu kỳ 15s theo đặc tả BE2)
   */
  sendHeartbeat: async (
    eventId: string,
  ): Promise<WaitingRoomStatusResponse> => {
    const result = await apiClient<WaitingRoomStatusResponse>(
      `/waiting-room/${encodeURIComponent(eventId)}/heartbeat`,
      { method: "POST" },
    );
    if (result.status === "ADMITTED" && result.admissionToken) {
      saveAdmissionToken(eventId, result.admissionToken);
    }
    return result;
  },
};
