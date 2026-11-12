import { Module } from "@nestjs/common";
import { RedisModule } from "../../database/redis.module";
import { SearchEventsUseCase } from "./application/search-events.use-case";
import { SearchController } from "./interface/search.controller";
import { SearchRateLimitGuard } from "./interface/search-rate-limit.guard";
import { createSearchEventsUseCase } from "./search.composition";

@Module({
  imports: [RedisModule],
  controllers: [SearchController],
  providers: [
    {
      provide: SearchEventsUseCase,
      useFactory: () => createSearchEventsUseCase(),
    },
    SearchRateLimitGuard,
  ],
  exports: [SearchEventsUseCase],
})
export class SearchModule {}
