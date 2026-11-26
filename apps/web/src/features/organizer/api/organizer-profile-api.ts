import { apiClient, ApiError } from "@/shared/api/client";
import { MOCK_ORGANIZER_PROFILES } from "../data/mock-organizer-profiles";
import type { OrganizerProfile } from "../domain/organizer.types";

/**
 * Lay thong tin ho so BTC cua tai khoan dang dang nhap
 */
export async function getMyOrganizerProfile(): Promise<OrganizerProfile> {
  try {
    return await apiClient<OrganizerProfile>("/organizer/profile", {
      method: "GET",
    });
  } catch (err) {
    if (err instanceof ApiError && err.status !== 0 && err.status !== 404) {
      throw err;
    }
    await new Promise((r) => setTimeout(r, 200));
    return MOCK_ORGANIZER_PROFILES[0];
  }
}

/**
 * Cap nhat va gui duyet lai ho so BTC
 */
export async function updateMyOrganizerProfile(
  payload: Partial<OrganizerProfile>,
): Promise<OrganizerProfile> {
  try {
    return await apiClient<OrganizerProfile>("/organizer/profile", {
      method: "PUT",
      body: JSON.stringify(payload),
    });
  } catch (err) {
    if (err instanceof ApiError && err.status !== 0 && err.status !== 404) {
      throw err;
    }
    await new Promise((r) => setTimeout(r, 250));
    const current = MOCK_ORGANIZER_PROFILES[0];
    const updated: OrganizerProfile = {
      ...current,
      ...payload,
      status: "PENDING_VERIFICATION",
      rejectionReason: undefined,
      updatedAt: new Date().toISOString(),
    };
    MOCK_ORGANIZER_PROFILES[0] = updated;
    return updated;
  }
}
