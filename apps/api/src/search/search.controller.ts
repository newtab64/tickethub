import { BadRequestException, Controller, Get, Query } from "@nestjs/common";

import { SearchService, SearchQuerySchema } from "./search.service";

@Controller("api/v1/search")
export class SearchController {
  constructor(private readonly searchService: SearchService) {}

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

    const data = await this.searchService.searchEvents(parsed.data);

    return {
      success: true,
      data,
    };
  }
}
