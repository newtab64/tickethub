import type {
  CreateEventRequest,
  EventRecord,
  EventUpdatePatch,
  EventWithTicketTypes,
  InventoryTicketType,
  OrganizerProfileRef,
  SeatPlan,
  SeatRow,
  SeatStatusCounts,
} from "./event.models";

export interface OrganizerProfileLookup {
  findByUserId(userId: string): Promise<OrganizerProfileRef | null>;
}

export interface EventRepository {
  slugExists(slug: string): Promise<boolean>;
  /** Tao su kien DRAFT, cac hang ve va outbox EVENT_CREATED trong mot transaction. */
  createWithTicketTypes(
    organizerId: string,
    dto: CreateEventRequest,
  ): Promise<EventWithTicketTypes>;
  listByOrganizer(organizerId: string): Promise<EventWithTicketTypes[]>;
  findOrganizerDetail(
    organizerId: string,
    eventId: string,
  ): Promise<(EventWithTicketTypes & { gates: unknown[] }) | null>;
  countSeats(eventId: string): Promise<number>;
  countSeatsOfTicketType(
    eventId: string,
    ticketTypeId: string,
  ): Promise<number>;
  findOwned(organizerId: string, eventId: string): Promise<EventRecord | null>;
  findOwnedWithTicketTypes(
    organizerId: string,
    eventId: string,
  ): Promise<EventWithTicketTypes | null>;
  hasNonCancelledTickets(eventId: string): Promise<boolean>;
  /** Cap nhat co dieu kien version; tra ve null neu version da thay doi. */
  updateIfVersion(
    eventId: string,
    expectedVersion: number,
    patch: EventUpdatePatch,
  ): Promise<EventRecord | null>;
  /** Xoa ghe cu, chen ghe moi, cap nhat suc chua hang ve va tang version su kien. */
  replaceSeatLayout(
    eventId: string,
    nextVersion: number,
    plan: SeatPlan,
  ): Promise<void>;
  /** Chuyen PENDING_APPROVAL va ghi outbox EVENT_SUBMITTED_FOR_APPROVAL. */
  submitForApproval(
    event: EventWithTicketTypes,
    organizerId: string,
  ): Promise<{
    eventId: string | undefined;
    status: string | undefined;
    version: number | undefined;
  }>;
  listPublished(limit: number): Promise<EventWithTicketTypes[]>;
  findPublishedBySlug(slug: string): Promise<EventWithTicketTypes | null>;
}

/** Cong doc cho cac mo hinh doc (so do ghe, ton kho). */
export interface EventReadRepository {
  findWithTicketTypes(eventId: string): Promise<EventWithTicketTypes | null>;
  listSeatsOrdered(eventId: string): Promise<SeatRow[]>;
  publishedEventExists(eventId: string): Promise<boolean>;
  listInventoryTicketTypes(eventId: string): Promise<InventoryTicketType[]>;
  countSeatsByStatus(eventId: string): Promise<SeatStatusCounts[]>;
}

/** Cache doc-qua; loi ha tang bi nuot de khong lam hong luong chinh. */
export interface ReadCache {
  get<T>(key: string): Promise<T | null>;
  set(key: string, value: unknown, ttlSeconds: number): Promise<void>;
  del(...keys: string[]): Promise<void>;
}

/** Cong phat thong bao trang thai ghe thoi gian thuc cho cac context khac. */
export interface SeatStatusPublisher {
  publishSeatStatusChanged(
    eventId: string,
    payload: {
      seatIds: string[];
      status: "AVAILABLE" | "HELD" | "SOLD" | "BLOCKED";
      expiresAt: string | null;
    },
  ): Promise<void>;
}
