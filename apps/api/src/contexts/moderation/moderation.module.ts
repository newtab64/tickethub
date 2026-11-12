import { Module } from "@nestjs/common";
import { EventReadModel } from "../event/application/event-read-model";
import { EventModule } from "../event/event.module";
import { IdentityModule } from "../identity/identity.module";
import { AuditLogQueries } from "./application/audit-log-queries.service";
import { EventModerationService } from "./application/event-moderation.service";
import { KycModerationService } from "./application/kyc-moderation.service";
import { AdminController } from "./interface/admin.controller";
import { createModerationServices } from "./moderation.composition";

const MODERATION_SERVICES = Symbol("MODERATION_SERVICES");
type ModerationServices = ReturnType<typeof createModerationServices>;

@Module({
  imports: [IdentityModule, EventModule],
  controllers: [AdminController],
  providers: [
    {
      provide: MODERATION_SERVICES,
      useFactory: (cache?: EventReadModel) => createModerationServices(cache),
      inject: [{ token: EventReadModel, optional: true }],
    },
    {
      provide: KycModerationService,
      useFactory: (s: ModerationServices) => s.kyc,
      inject: [MODERATION_SERVICES],
    },
    {
      provide: EventModerationService,
      useFactory: (s: ModerationServices) => s.events,
      inject: [MODERATION_SERVICES],
    },
    {
      provide: AuditLogQueries,
      useFactory: (s: ModerationServices) => s.auditLogs,
      inject: [MODERATION_SERVICES],
    },
  ],
})
export class ModerationModule {}
