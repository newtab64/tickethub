import {
  Controller,
  Get,
  Param,
  Query,
  ParseUUIDPipe,
  BadRequestException,
  Inject,
} from "@nestjs/common";
import { VenueQueries } from "../application/venue-queries.service";
import { mapVenueErrors } from "./venue-http";
import { VenueFilterQuerySchema } from "@tickethub/shared";

@Controller("api/v1/venues")
export class VenuesController {
  constructor(
    @Inject(VenueQueries) private readonly venueQueries: VenueQueries,
  ) {}

  @Get()
  async getVenues(@Query() query: unknown) {
    const parseResult = VenueFilterQuerySchema.safeParse(query);
    if (!parseResult.success) {
      throw new BadRequestException({
        success: false,
        error: {
          code: "INVALID_QUERY_PARAMS",
          message: "Tham số tìm kiếm không hợp lệ",
          details: parseResult.error.format(),
          timestamp: new Date().toISOString(),
        },
      });
    }

    const data = await mapVenueErrors(() =>
      this.venueQueries.getVenues(parseResult.data),
    );
    return {
      success: true,
      data,
    };
  }

  @Get(":id")
  async getVenueById(@Param("id", ParseUUIDPipe) id: string) {
    const data = await mapVenueErrors(() => this.venueQueries.getVenueById(id));
    return {
      success: true,
      data,
    };
  }

  @Get(":id/layouts")
  async getVenueLayouts(@Param("id", ParseUUIDPipe) id: string) {
    const data = await mapVenueErrors(() =>
      this.venueQueries.getVenueLayouts(id),
    );
    return {
      success: true,
      data,
    };
  }
}
