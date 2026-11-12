import { EventStatus } from "@tickethub/shared";
import { apiClient, ApiError } from "@/shared/api/client";
import {
  MOCK_ORGANIZER_EVENTS,
  MOCK_ORGANIZER_PROFILES,
  type OrganizerEventItem,
  type OrganizerProfile,
} from "@/features/organizer";
import { MOCK_AUDIT_LOGS } from "../data/mock-audit-logs";
import type { AuditLogEntry } from "../domain/moderation.types";

/**
 * Admin: Lay danh sach toan bo ho so BTC
 */
export async function getAdminOrganizers(): Promise<OrganizerProfile[]> {
  try {
    return await apiClient<OrganizerProfile[]>("/admin/organizers", {
      method: "GET",
    });
  } catch (err) {
    if (err instanceof ApiError && err.status !== 0 && err.status !== 404) {
      throw err;
    }
    await new Promise((r) => setTimeout(r, 200));
    return [...MOCK_ORGANIZER_PROFILES];
  }
}

/**
 * Admin: Duyet hoac Tu choi ho so BTC (UC10)
 */
export async function reviewOrganizerProfile(params: {
  id: string;
  decision: "APPROVE" | "REJECT";
  reason?: string;
}): Promise<OrganizerProfile> {
  const { id, decision, reason } = params;
  try {
    const endpoint =
      decision === "APPROVE"
        ? `/admin/organizers/${id}/approve`
        : `/admin/organizers/${id}/reject`;
    return await apiClient<OrganizerProfile>(endpoint, {
      method: "POST",
      body: JSON.stringify({ reason }),
    });
  } catch (err) {
    if (err instanceof ApiError && err.status !== 0 && err.status !== 404) {
      throw err;
    }
    await new Promise((r) => setTimeout(r, 250));
    const item = MOCK_ORGANIZER_PROFILES.find((o) => o.id === id);
    if (!item) throw new Error("Không tìm thấy hồ sơ BTC");

    item.status = decision === "APPROVE" ? "VERIFIED" : "REJECTED";
    item.rejectionReason = decision === "REJECT" ? reason : undefined;
    item.updatedAt = new Date().toISOString();

    MOCK_AUDIT_LOGS.unshift({
      id: `log-${Date.now()}`,
      action: decision === "APPROVE" ? "APPROVE_ORGANIZER" : "REJECT_ORGANIZER",
      targetName: item.organizationName,
      actorEmail: "admin@tickethub.com",
      reason,
      timestamp: new Date().toISOString(),
    });

    return { ...item };
  }
}

/**
 * Lay danh sach su kien tu BE1 (events.controller.ts) kem fallback sang Mock
 */
export async function getAdminPendingEvents(): Promise<OrganizerEventItem[]> {
  try {
    const res = await apiClient<
      OrganizerEventItem[] | { items: OrganizerEventItem[] }
    >("/events?status=PENDING_APPROVAL", { method: "GET" });
    const list = Array.isArray(res) ? res : res?.items;
    if (list !== undefined && list !== null) {
      return list;
    }
  } catch (err) {
    if (err instanceof ApiError && err.status !== 0 && err.status !== 404) {
      throw err;
    }
  }
  await new Promise((r) => setTimeout(r, 200));
  return MOCK_ORGANIZER_EVENTS.filter(
    (e) =>
      e.status === EventStatus.PENDING_APPROVAL ||
      e.status === EventStatus.CANCELLED,
  );
}

/**
 * Admin: Duyet hoac Tu choi su kien (PENDING_APPROVAL -> PUBLISHED / CANCELLED)
 */
export async function reviewAdminEvent(params: {
  id: string;
  decision: "APPROVE" | "REJECT";
  reason?: string;
}): Promise<OrganizerEventItem> {
  const { id, decision, reason } = params;
  try {
    const endpoint =
      decision === "APPROVE"
        ? `/admin/events/${id}/approve`
        : `/admin/events/${id}/reject`;
    return await apiClient<OrganizerEventItem>(endpoint, {
      method: "POST",
      body: JSON.stringify({ reason }),
    });
  } catch (err) {
    if (err instanceof ApiError && err.status !== 0 && err.status !== 404) {
      throw err;
    }
    await new Promise((r) => setTimeout(r, 250));
    const evt = MOCK_ORGANIZER_EVENTS.find((e) => e.id === id);
    if (!evt) throw new Error("Không tìm thấy sự kiện");

    evt.status =
      decision === "APPROVE" ? EventStatus.PUBLISHED : EventStatus.CANCELLED;
    evt.rejectionReason = decision === "REJECT" ? reason : undefined;
    evt.version += 1;

    MOCK_AUDIT_LOGS.unshift({
      id: `log-${Date.now()}`,
      action: decision === "APPROVE" ? "APPROVE_EVENT" : "REJECT_EVENT",
      targetName: evt.title,
      actorEmail: "admin@tickethub.com",
      reason,
      timestamp: new Date().toISOString(),
    });

    return { ...evt };
  }
}

export async function getAdminAuditLogs(): Promise<AuditLogEntry[]> {
  return [...MOCK_AUDIT_LOGS];
}
