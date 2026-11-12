import { EVENTS } from "../data/events-catalog";
import type { EventItem } from "../domain/event.types";

export { EVENTS };

export function getEventById(id: string): EventItem | undefined {
  return EVENTS.find((ev) => ev.id === id);
}
