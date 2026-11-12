import type {
  CreateEventRequest,
  GenerateSeatsDto,
  OrganizerProfileRef,
  UpdateEventDto,
} from "../domain/event.models";
import {
  assertCanGenerateSeats,
  assertEditable,
  assertHasTicketTypes,
  assertSeatsGenerated,
  assertSubmittableStatus,
  assertVerifiedOrganizer,
  assertVersionMatches,
  assertZonesMatchTicketTypes,
  buildUpdatePatch,
  planSeats,
} from "../domain/event-rules";
import { eventErrors } from "../domain/event.errors";
import type {
  EventRepository,
  OrganizerProfileLookup,
} from "../domain/event.ports";

/** Lenh va truy van cua Ban to chuc tren su kien cua chinh ho. */
export class OrganizerEventService {
  constructor(
    private readonly events: EventRepository,
    private readonly profiles: OrganizerProfileLookup,
  ) {}

  private async verifiedProfile(userId: string): Promise<OrganizerProfileRef> {
    return assertVerifiedOrganizer(await this.profiles.findByUserId(userId));
  }

  async createEvent(userId: string, dto: CreateEventRequest) {
    const profile = await this.verifiedProfile(userId);
    if (await this.events.slugExists(dto.slug)) {
      throw eventErrors.slugExists(dto.slug);
    }
    return this.events.createWithTicketTypes(profile.id, dto);
  }

  async getOrganizerEvents(userId: string) {
    const profile = await this.verifiedProfile(userId);
    return this.events.listByOrganizer(profile.id);
  }

  async getOrganizerEventById(userId: string, eventId: string) {
    const profile = await this.verifiedProfile(userId);
    const event = await this.events.findOrganizerDetail(profile.id, eventId);
    if (!event) throw eventErrors.organizerEventNotFound();
    const totalSeats = await this.events.countSeats(eventId);
    return { ...event, totalSeats };
  }

  async updateEvent(userId: string, eventId: string, dto: UpdateEventDto) {
    const profile = await this.verifiedProfile(userId);
    const event = await this.events.findOwned(profile.id, eventId);
    if (!event) throw eventErrors.eventToUpdateNotFound();

    assertEditable(event);
    assertVersionMatches(event, dto.version);

    const patch = buildUpdatePatch(event, dto, new Date());
    const updated = await this.events.updateIfVersion(
      eventId,
      dto.version,
      patch,
    );
    if (!updated) throw eventErrors.versionConflict();
    return updated;
  }

  async generateSeats(userId: string, eventId: string, dto: GenerateSeatsDto) {
    const profile = await this.verifiedProfile(userId);
    const event = await this.events.findOwnedWithTicketTypes(
      profile.id,
      eventId,
    );
    if (!event) throw eventErrors.eventNotFound();

    assertCanGenerateSeats(event);
    if (await this.events.hasNonCancelledTickets(eventId)) {
      throw eventErrors.cannotModifySoldSeats();
    }
    assertZonesMatchTicketTypes(event.ticketTypes, dto.zones);

    const plan = planSeats(dto.zones);
    await this.events.replaceSeatLayout(eventId, event.version + 1, plan);

    return {
      eventId,
      totalSeatsGenerated: plan.seats.length,
      updatedTicketTypes: Array.from(plan.capacityByTicketType.entries()).map(
        ([ticketTypeId, capacity]) => ({ ticketTypeId, capacity }),
      ),
    };
  }

  async submitEventForApproval(userId: string, eventId: string) {
    const profile = await this.verifiedProfile(userId);
    const event = await this.events.findOwnedWithTicketTypes(
      profile.id,
      eventId,
    );
    if (!event) throw eventErrors.eventNotFound();

    assertSubmittableStatus(event);
    assertHasTicketTypes(event.ticketTypes);

    for (const tt of event.ticketTypes) {
      if (tt.isSeated) {
        const count = await this.events.countSeatsOfTicketType(eventId, tt.id);
        assertSeatsGenerated(tt, count);
      }
    }

    return this.events.submitForApproval(event, profile.id);
  }
}
