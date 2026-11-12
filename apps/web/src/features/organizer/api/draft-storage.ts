// Tu dong luu ban nhap su kien tren trinh duyet (localStorage) cho den khi backend co endpoint ban nhap.
import type { EventDraftData } from "../domain/organizer.types";

const DRAFT_STORAGE_KEY = "tickethub_organizer_event_draft";

/**
 * Saves draft to localStorage and records timestamp.
 *
 * // TODO(contract): POST /api/v1/events/draft is missing in API_CONTRACT.md.
 * Client-side persistence adapter is used until a backend draft endpoint is specified.
 */
export function saveEventDraft(draft: Omit<EventDraftData, "savedAt">): {
  savedAt: string;
} {
  const savedAt = new Date().toISOString();
  const payload: EventDraftData = {
    ...draft,
    savedAt,
  };
  try {
    if (typeof window !== "undefined") {
      localStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(payload));
    }
  } catch {
    // Storage quota or SSR safe fallback
  }
  return { savedAt };
}

/**
 * Loads saved draft from localStorage if available.
 */
export function getSavedEventDraft(): EventDraftData | null {
  try {
    if (typeof window !== "undefined") {
      const data = localStorage.getItem(DRAFT_STORAGE_KEY);
      if (data) {
        return JSON.parse(data) as EventDraftData;
      }
    }
  } catch {
    return null;
  }
  return null;
}

/**
 * Clears saved draft from storage after publishing.
 */
export function clearSavedEventDraft(): void {
  try {
    if (typeof window !== "undefined") {
      localStorage.removeItem(DRAFT_STORAGE_KEY);
    }
  } catch {
    // ignore
  }
}
