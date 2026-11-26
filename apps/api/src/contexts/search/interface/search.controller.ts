import {
  BadRequestException,
  Controller,
  Get,
  Inject,
  Query,
  UseGuards,
} from "@nestjs/common";
import { SearchQuerySchema } from "@tickethub/shared";

import { SearchEventsUseCase } from "../application/search-events.use-case";
import { InvalidSearchCursorError } from "../domain/search.errors";
import { SearchRateLimitGuard } from "./search-rate-limit.guard";

@Controller("api/v1/search")
@UseGuards(SearchRateLimitGuard)
export class SearchController {
  constructor(
    @Inject(SearchEventsUseCase)
    private readonly searchEventsUseCase: SearchEventsUseCase,
  ) {}

  @Get("events")
  async searchEvents(@Query() query: unknown) {
    const parsed = SearchQuerySchema.safeParse(query);

    if (!parsed.success) {
      throw new BadRequestException({
        success: false,
        error: {
          code: "VALIDATION_ERROR",
          message: "Bo loc tim kiem khong hop le",
          details: parsed.error.format(),
          timestamp: new Date().toISOString(),
        },
      });
    }

    let data;
    try {
      data = await this.searchEventsUseCase.execute(parsed.data);
    } catch (err) {
      if (err instanceof InvalidSearchCursorError) {
        throw new BadRequestException(err.message);
      }
      throw err;
    }

    return {
      success: true,
      data,
    };
  }
}
