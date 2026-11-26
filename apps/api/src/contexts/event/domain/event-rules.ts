import { EventStatus, OrganizerStatus } from "@tickethub/shared";
import { eventErrors } from "./event.errors";
import type {
  EventRecord,
  EventUpdatePatch,
  GenerateSeatsDto,
  InventoryItem,
  InventoryTicketType,
  OrganizerProfileRef,
  SeatMap,
  SeatPlan,
  SeatRow,
  SeatStatusCounts,
  TicketTypeRecord,
  UpdateEventDto,
} from "./event.models";

/** Ban to chuc phai co ho so va da duoc quan tri vien phe duyet. */
export function assertVerifiedOrganizer(
  profile: OrganizerProfileRef | null,
): OrganizerProfileRef {
  if (!profile) throw eventErrors.organizerProfileRequired();
  if (profile.status !== OrganizerStatus.VERIFIED) {
    throw eventErrors.organizerNotVerified();
  }
  return profile;
}

export function assertEditable(event: Pick<EventRecord, "status">): void {
  if (event.status !== EventStatus.DRAFT) {
    throw eventErrors.cannotEdit(event.status);
  }
}

/** Khoa lac quan: version gui len phai trung voi version hien tai. */
export function assertVersionMatches(
  event: Pick<EventRecord, "version">,
  expected: number,
): void {
  if (event.version !== expected) throw eventErrors.concurrentModification();
}

/** Chi cac truong co gia tri moi duoc cap nhat; version tang them 1. */
export function buildUpdatePatch(
  event: Pick<EventRecord, "version">,
  dto: UpdateEventDto,
  now: Date,
): EventUpdatePatch {
  const patch: EventUpdatePatch = {
    version: event.version + 1,
    updatedAt: now,
  };
  if (dto.title) patch.title = dto.title;
  if (dto.description) patch.description = dto.description;
  if (dto.category) patch.category = dto.category;
  if (dto.bannerUrl) patch.bannerUrl = dto.bannerUrl;
  if (dto.venueName) patch.venueName = dto.venueName;
  if (dto.venueAddress) patch.venueAddress = dto.venueAddress;
  if (dto.city) patch.city = dto.city;
  if (dto.startTime) patch.startTime = new Date(dto.startTime);
  if (dto.endTime) patch.endTime = new Date(dto.endTime);
  if (dto.gateOpeningTime)
    patch.gateOpeningTime = new Date(dto.gateOpeningTime);
  return patch;
}

export function assertCanGenerateSeats(
  event: Pick<EventRecord, "status">,
): void {
  if (event.status !== EventStatus.DRAFT)
    throw eventErrors.cannotGenerateSeats();
}

/** Moi khu phai tro toi hang ve co ghe ngoi thuoc su kien. */
export function assertZonesMatchTicketTypes(
  ticketTypes: TicketTypeRecord[],
  zones: GenerateSeatsDto["zones"],
): void {
  const byId = new Map(ticketTypes.map((tt) => [tt.id, tt]));
  for (const zone of zones) {
    const tt = byId.get(zone.ticketTypeId);
    if (!tt) throw eventErrors.invalidTicketType(zone.ticketTypeId);
    if (!tt.isSeated) throw eventErrors.ticketTypeNotSeated(tt.name);
  }
}

export function formatSeatNumber(index: number): string {
  return index < 10 ? `0${index}` : `${index}`;
}

/** Sinh danh sach ghe theo hang va tong suc chua moi hang ve. */
export function planSeats(zones: GenerateSeatsDto["zones"]): SeatPlan {
  const seats: SeatPlan["seats"] = [];
  const capacityByTicketType = new Map<string, number>();

  for (const zone of zones) {
    let countForZone = 0;
    for (const rowLabel of zone.rows) {
      for (let i = 1; i <= zone.seatsPerRow; i++) {
        seats.push({
          zoneName: zone.zoneName,
          ticketTypeId: zone.ticketTypeId,
          rowLabel,
          seatNumber: formatSeatNumber(i),
        });
        countForZone++;
      }
    }
    capacityByTicketType.set(
      zone.ticketTypeId,
      (capacityByTicketType.get(zone.ticketTypeId) ?? 0) + countForZone,
    );
  }
  return { seats, capacityByTicketType };
}

export function assertSubmittableStatus(
  event: Pick<EventRecord, "status">,
): void {
  if (event.status !== EventStatus.DRAFT) {
    throw eventErrors.cannotSubmit(event.status);
  }
}

export function assertHasTicketTypes(ticketTypes: TicketTypeRecord[]): void {
  if (ticketTypes.length === 0) throw eventErrors.noTicketTypes();
}

export function assertSeatsGenerated(
  ticketType: Pick<TicketTypeRecord, "name">,
  seatCount: number,
): void {
  if (seatCount === 0) throw eventErrors.seatsNotGenerated(ticketType.name);
}

/** Gom ghe theo khu va hang de ve so do ghe. */
export function groupSeatMap(eventId: string, seats: SeatRow[]): SeatMap {
  const zones = new Map<
    string,
    {
      zoneName: string;
      ticketTypeId: string;
      rows: Map<
        string,
        Array<{ id: string; seatNumber: string; status: string }>
      >;
    }
  >();

  for (const seat of seats) {
    let zone = zones.get(seat.zoneName);
    if (!zone) {
      zone = {
        zoneName: seat.zoneName,
        ticketTypeId: seat.ticketTypeId,
        rows: new Map(),
      };
      zones.set(seat.zoneName, zone);
    }
    let row = zone.rows.get(seat.rowLabel);
    if (!row) {
      row = [];
      zone.rows.set(seat.rowLabel, row);
    }
    row.push({ id: seat.id, seatNumber: seat.seatNumber, status: seat.status });
  }

  return {
    eventId,
    zones: Array.from(zones.values()).map((zone) => ({
      zoneName: zone.zoneName,
      ticketTypeId: zone.ticketTypeId,
      isSeated: true,
      rows: Array.from(zone.rows.entries()).map(([rowLabel, list]) => ({
        rowLabel,
        seats: list,
      })),
    })),
  };
}

/**
 * Ton kho: ve dung dung bo dem (capacity - held - sold), ve ngoi dem tu bang
 * ghe da duoc gom theo trang thai.
 */
export function buildInventoryItems(
  types: InventoryTicketType[],
  seatCounts: SeatStatusCounts[],
): InventoryItem[] {
  const byType = new Map(seatCounts.map((c) => [c.ticketTypeId, c]));
  return types.map((tt) => {
    if (!tt.isSeated) {
      return {
        ticketTypeId: tt.id,
        name: tt.name,
        price: tt.price,
        isSeated: false,
        capacity: tt.capacity,
        available: Math.max(0, tt.capacity - tt.heldCount - tt.soldCount),
        held: tt.heldCount,
        sold: tt.soldCount,
        blocked: 0,
      };
    }
    const count = byType.get(tt.id);
    return {
      ticketTypeId: tt.id,
      name: tt.name,
      price: tt.price,
      isSeated: true,
      capacity: tt.capacity,
      available: count?.available ?? 0,
      held: count?.held ?? 0,
      sold: count?.sold ?? 0,
      blocked: count?.blocked ?? 0,
    };
  });
}
