import type { CreateEventRequest } from "@tickethub/shared";

export type { CreateEventRequest };

/** Hang ve thuoc su kien (hinh dang day du nhu API cong bo). */
export type TicketTypeRecord = {
  id: string;
  name: string;
  isSeated: boolean;
} & Record<string, unknown>;

/** Su kien (hinh dang day du nhu API cong bo). */
export type EventRecord = {
  id: string;
  organizerId: string;
  title: string;
  slug: string;
  status: string;
  version: number;
} & Record<string, unknown>;

export type EventWithTicketTypes = EventRecord & {
  ticketTypes: TicketTypeRecord[];
};

export interface OrganizerProfileRef {
  id: string;
  status: string;
}

export interface GenerateSeatsDto {
  zones: Array<{
    zoneName: string;
    ticketTypeId: string;
    rows: string[];
    seatsPerRow: number;
  }>;
}

export interface UpdateEventDto {
  title?: string;
  description?: string;
  category?: string;
  bannerUrl?: string;
  venueName?: string;
  venueAddress?: string;
  city?: string;
  startTime?: string;
  endTime?: string;
  gateOpeningTime?: string;
  version: number;
}

/** Cac cot duoc phep thay doi khi chinh sua su kien DRAFT. */
export interface EventUpdatePatch {
  version: number;
  updatedAt: Date;
  title?: string;
  description?: string;
  category?: string;
  bannerUrl?: string;
  venueName?: string;
  venueAddress?: string;
  city?: string;
  startTime?: Date;
  endTime?: Date;
  gateOpeningTime?: Date;
}

export interface SeatDraft {
  zoneName: string;
  ticketTypeId: string;
  rowLabel: string;
  seatNumber: string;
}

export interface SeatPlan {
  seats: SeatDraft[];
  capacityByTicketType: Map<string, number>;
}

export interface SeatMapSeat {
  id: string;
  seatNumber: string;
  status: string;
}

export interface SeatRow {
  id: string;
  zoneName: string;
  ticketTypeId: string;
  rowLabel: string;
  seatNumber: string;
  status: string;
}

export interface SeatMapZone {
  zoneName: string;
  ticketTypeId: string;
  isSeated: boolean;
  rows: Array<{ rowLabel: string; seats: SeatMapSeat[] }>;
}

export interface SeatMap {
  eventId: string;
  zones: SeatMapZone[];
}

export interface InventoryTicketType {
  id: string;
  name: string;
  price: string;
  capacity: number;
  heldCount: number;
  soldCount: number;
  isSeated: boolean;
}

export interface SeatStatusCounts {
  ticketTypeId: string;
  available: number;
  held: number;
  sold: number;
  blocked: number;
}

export interface InventoryItem {
  ticketTypeId: string;
  name: string;
  price: string;
  isSeated: boolean;
  capacity: number;
  available: number;
  held: number;
  sold: number;
  blocked: number;
}

export interface EventInventory {
  eventId: string;
  items: InventoryItem[];
  refreshedAt: string;
}
