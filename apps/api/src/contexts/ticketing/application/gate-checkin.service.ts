import type { GateLookupResponse, GateScanResponse } from "@tickethub/shared";
import {
  assertEventActive,
  assertLookupEligible,
  explainFailedCheckIn,
  matchesBuyerLast4,
  requiresStaffAssignment,
  seatLabelFor,
} from "../domain/checkin-rules";
import { ticketingErrors } from "../domain/ticketing.errors";
import type {
  CheckInActor,
  GateLookupRequest,
  GateScanRequest,
} from "../domain/ticketing.models";
import type { GateRepository, QrTokenService } from "../domain/ticketing.ports";

/**
 * Soat ve tai cong: quet QR dong Ed25519 va tra cuu thu cong du phong.
 * Cap nhat trang thai ve bang UPDATE nguyen tu (WHERE status = 'SOLD').
 */
export class GateCheckInService {
  constructor(
    private readonly gate: GateRepository,
    private readonly qrTokens: QrTokenService,
  ) {}

  async scanTicket(
    staffUserId: string,
    staffRole: string,
    dto: GateScanRequest,
  ): Promise<GateScanResponse> {
    const payload = this.qrTokens.verify(dto.qrToken);

    await this.assertStaffAllowed({ staffUserId, staffRole }, payload.eventId);
    const event = assertEventActive(await this.gate.findEvent(payload.eventId));
    await this.assertGateValid(dto.gateId, payload.eventId);

    const updated = await this.gate.checkInIfSold(
      payload.sub,
      staffUserId,
      dto.gateId ?? null,
      new Date(),
    );
    if (!updated) {
      explainFailedCheckIn(await this.gate.findTicketState(payload.sub));
    }
    const checkedIn = updated!;

    const info = await this.gate.findScanDetails(checkedIn.id);

    return {
      ticketId: checkedIn.id,
      ticketCode: checkedIn.ticketCode,
      status: checkedIn.status,
      eventTitle: event.title,
      ticketTypeName: info?.ticketTypeName || "",
      zoneName: info?.zoneName ?? undefined,
      seatLabel: seatLabelFor(info),
      isSeated: info?.isSeated ?? false,
      buyerName: info?.buyerName || "",
      checkedInAt: checkedIn.checkedInAt.toISOString(),
      gateId: checkedIn.gateId ?? undefined,
      staffId: staffUserId,
    } as GateScanResponse;
  }

  async lookupTicket(
    staffUserId: string,
    staffRole: string,
    dto: GateLookupRequest,
  ): Promise<GateLookupResponse> {
    await this.assertStaffAllowed({ staffUserId, staffRole }, dto.eventId);
    const event = assertEventActive(await this.gate.findEvent(dto.eventId));
    await this.assertGateValid(dto.gateId, dto.eventId);

    const ticket = await this.gate.findLookupTicket(
      dto.ticketCode,
      dto.eventId,
    );
    if (!ticket) throw ticketingErrors.lookupTicketNotFound();
    assertLookupEligible(ticket);

    if (
      !matchesBuyerLast4(
        { phone: ticket.buyerPhone, email: ticket.buyerEmail },
        dto.phoneOrEmailLast4,
      )
    ) {
      throw ticketingErrors.verificationFailed();
    }

    const now = new Date();
    const updated = await this.gate.checkInManually({
      ticketId: ticket.id,
      staffUserId,
      staffRole,
      gateId: dto.gateId ?? null,
      now,
      audit: {
        ticketCode: dto.ticketCode,
        reason: dto.reason,
        phoneOrEmailLast4: dto.phoneOrEmailLast4,
        gateId: dto.gateId ?? null,
        timestamp: now.toISOString(),
      },
    });
    if (!updated) throw ticketingErrors.alreadyCheckedIn();

    return {
      ticketId: updated.id,
      ticketCode: updated.ticketCode,
      status: updated.status,
      eventTitle: event.title,
      ticketTypeName: ticket.ticketTypeName,
      zoneName: ticket.zoneName ?? undefined,
      seatLabel: seatLabelFor(ticket),
      isSeated: ticket.isSeated,
      buyerName: ticket.buyerName,
      checkedInAt: updated.checkedInAt.toISOString(),
      gateId: updated.gateId ?? undefined,
      staffId: staffUserId,
      method: "MANUAL_LOOKUP",
    } as GateLookupResponse;
  }

  private async assertStaffAllowed(actor: CheckInActor, eventId: string) {
    if (
      requiresStaffAssignment(actor.staffRole) &&
      !(await this.gate.isStaffAssigned(eventId, actor.staffUserId))
    ) {
      throw ticketingErrors.staffNotAssigned();
    }
  }

  private async assertGateValid(gateId: string | undefined, eventId: string) {
    if (gateId && !(await this.gate.gateBelongsToEvent(gateId, eventId))) {
      throw ticketingErrors.invalidGate();
    }
  }
}
