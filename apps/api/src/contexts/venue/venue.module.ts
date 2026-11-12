import { Module } from "@nestjs/common";
import type Redis from "ioredis";
import { REDIS_CLIENT } from "../../database/redis.module";
import { IdentityModule } from "../identity/identity.module";
import { VenueCommands } from "./application/venue-commands.service";
import { VenueQueries } from "./application/venue-queries.service";
import { createVenueServices } from "./venue.composition";
import { AdminVenuesController } from "./interface/admin-venues.controller";
import { VenuesController } from "./interface/venues.controller";

@Module({
  imports: [IdentityModule],
  controllers: [VenuesController, AdminVenuesController],
  providers: [
    {
      provide: VenueQueries,
      useFactory: (redis: Redis) => createVenueServices(redis).queries,
      inject: [REDIS_CLIENT],
    },
    {
      provide: VenueCommands,
      useFactory: (redis: Redis) => createVenueServices(redis).commands,
      inject: [REDIS_CLIENT],
    },
  ],
  exports: [VenueQueries, VenueCommands],
})
export class VenueModule {}
