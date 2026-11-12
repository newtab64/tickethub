import { EventStatus } from "@tickethub/shared";
import { MOCK_ORGANIZER_EVENTS } from "../data/mock-organizer-events";
import {
  computeOrganizerMetrics,
  queryOrganizerEvents,
} from "../domain/event-query";
import type {
  OrganizerEventItem,
  OrganizerEventsQuery,
  OrganizerEventsResponse,
  OrganizerMetrics,
} from "../domain/organizer.types";

/**
 * Danh sach su kien cua Ban to chuc (loc, tim kiem, sap xep, phan trang).
 *
 * // TODO(contract): GET /api/v1/organizer/events is missing in API_CONTRACT.md.
 * Hien doc tu du lieu tam; khi co endpoint se goi API co pham vi theo Ban to chuc.
 */
export async function getOrganizerEvents(
  query: OrganizerEventsQuery = {},
): Promise<OrganizerEventsResponse> {
  return queryOrganizerEvents(MOCK_ORGANIZER_EVENTS, query);
}

/**
 * Chi so tong hop cho thanh tom tat cua cong Ban to chuc.
 *
 * // TODO(contract): GET /api/v1/organizer/metrics is missing in API_CONTRACT.md.
 */
export async function getOrganizerMetrics(): Promise<OrganizerMetrics> {
  return computeOrganizerMetrics(MOCK_ORGANIZER_EVENTS);
}

// ==========================================
// 6. Event Action Handlers (Mocked Adapter)
// ==========================================

/**
 * // TODO(contract): POST /api/v1/events/:id/publish is missing in API_CONTRACT.md.
 */
export async function publishOrganizerEvent(id: string): Promise<boolean> {
  const item = MOCK_ORGANIZER_EVENTS.find((e) => e.id === id);
  if (item) {
    item.status = EventStatus.PUBLISHED;
    return true;
  }
  return false;
}

/**
 * // TODO(contract): POST /api/v1/events/:id/pause is missing in API_CONTRACT.md.
 */
export async function pauseOrganizerEvent(id: string): Promise<boolean> {
  const item = MOCK_ORGANIZER_EVENTS.find((e) => e.id === id);
  if (item) {
    item.status = EventStatus.SUSPENDED;
    return true;
  }
  return false;
}

/**
 * // TODO(contract): POST /api/v1/events/:id/cancel is missing in API_CONTRACT.md.
 */
export async function cancelOrganizerEvent(id: string): Promise<boolean> {
  const item = MOCK_ORGANIZER_EVENTS.find((e) => e.id === id);
  if (item) {
    item.status = EventStatus.CANCELLED;
    return true;
  }
  return false;
}

/**
 * // TODO(contract): POST /api/v1/events/:id/clone is missing in API_CONTRACT.md.
 */
export async function cloneOrganizerEvent(id: string): Promise<string> {
  const item = MOCK_ORGANIZER_EVENTS.find((e) => e.id === id);
  if (!item) throw new Error("EVENT_NOT_FOUND");
  const newId = `evt-clone-${Date.now()}`;
  const cloned: OrganizerEventItem = {
    ...item,
    id: newId,
    title: `${item.title} (Bản sao)`,
    slug: `${item.slug}-clone-${Date.now()}`,
    status: EventStatus.DRAFT,
    ticketsSold: 0,
    revenue: 0,
    version: 1,
  };
  MOCK_ORGANIZER_EVENTS.unshift(cloned);
  return newId;
}
