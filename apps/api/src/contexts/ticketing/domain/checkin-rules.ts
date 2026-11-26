import { EventStatus, TicketStatus, UserRole } from "@tickethub/shared";
import { ticketingErrors } from "./ticketing.errors";
import type {
  GateEventRef,
  QrTicketRecord,
  TicketSeatFields,
  TicketStateRow,
} from "./ticketing.models";

/** Chu ve hoac ADMIN moi duoc lay ma QR (chong IDOR). */
export function assertQrIssuable(
  ticket: QrTicketRecord | null,
  userId: string,
  role: string,
): QrTicketRecord {
  if (!ticket) throw ticketingErrors.ticketNotFound();
  if (ticket.userId !== userId && role !== UserRole.ADMIN) {
    throw ticketingErrors.accessDenied();
  }
  if (ticket.status === TicketStatus.CHECKED_IN) {
    throw ticketingErrors.alreadyUsed();
  }
  if (ticket.status !== TicketStatus.SOLD) {
    throw ticketingErrors.notActive(ticket.status);
  }
  if (ticket.eventStatus !== EventStatus.PUBLISHED) {
    throw ticketingErrors.eventNotActiveWithStatus(ticket.eventStatus);
  }
  return ticket;
}

/** Nhan vien soat ve phai duoc phan cong vao su kien (ADMIN duoc bo qua). */
export function requiresStaffAssignment(staffRole: string): boolean {
  return staffRole !== UserRole.ADMIN;
}

/** Kill Switch: su kien khong con PUBLISHED thi khong soat ve duoc. */
export function assertEventActive(event: GateEventRef | null): GateEventRef {
  if (!event || event.status !== EventStatus.PUBLISHED) {
    throw ticketingErrors.eventNotActive();
  }
  return event;
}

/** Phan tich nguyen nhan khi cap nhat nguyen tu soat ve khong chay duoc dong nao. */
export function explainFailedCheckIn(existing: TicketStateRow | null): never {
  if (!existing) throw ticketingErrors.ticketNotFound();
  if (existing.status === TicketStatus.CHECKED_IN) {
    throw ticketingErrors.alreadyUsedBy(
      existing.checkedInAt?.toISOString(),
      existing.checkedInBy,
    );
  }
  throw ticketingErrors.notEligible(existing.status);
}

export function assertLookupEligible(ticket: { status: string }): void {
  if (ticket.status === TicketStatus.CHECKED_IN) {
    throw ticketingErrors.alreadyUsed();
  }
  if (ticket.status !== TicketStatus.SOLD) {
    throw ticketingErrors.notEligible(ticket.status);
  }
}

/** Doi soat 4 so cuoi SDT, hoac 4 ky tu cuoi cua phan truoc @ hoac cua ca email. */
export function matchesBuyerLast4(
  buyer: { phone: string | null; email: string | null },
  input: string,
): boolean {
  const last4 = input.trim().toLowerCase();

  if (buyer.phone && buyer.phone.replace(/\D/g, "").slice(-4) === last4) {
    return true;
  }
  if (buyer.email) {
    const email = buyer.email.toLowerCase();
    const local = email.split("@")[0] || "";
    if (local.slice(-4) === last4 || email.slice(-4) === last4) return true;
  }
  return false;
}

/** Nhan vi tri; ve dung hien "GA - Fanzone (Ve dung)", khong bao gio "N/A". */
export function seatLabelFor(
  ticket: TicketSeatFields | null | undefined,
): string {
  return ticket?.isSeated && ticket?.seatNumber
    ? `Hàng ${ticket.rowLabel || ""} - Ghế ${ticket.seatNumber}`.trim()
    : "GA - Fanzone (Vé đứng)";
}
