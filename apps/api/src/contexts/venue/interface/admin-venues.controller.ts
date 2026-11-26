import {
  Controller,
  Post,
  Put,
  Param,
  Body,
  UseGuards,
  ParseUUIDPipe,
  BadRequestException,
  HttpCode,
  HttpStatus,
  Inject,
} from "@nestjs/common";
import { VenueCommands } from "../application/venue-commands.service";
import { mapVenueErrors } from "./venue-http";
import { JwtAuthGuard } from "../../identity/interface/guards/jwt-auth.guard";
import { RolesGuard } from "../../identity/interface/guards/roles.guard";
import { Roles } from "../../identity/interface/decorators/roles.decorator";
import {
  UserRole,
  CreateVenueSchema,
  UpdateVenueSchema,
  CreateVenueLayoutSchema,
} from "@tickethub/shared";

@Controller("api/v1/admin/venues")
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
export class AdminVenuesController {
  constructor(
    @Inject(VenueCommands) private readonly venueCommands: VenueCommands,
  ) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async createVenue(@Body() body: unknown) {
    const parseResult = CreateVenueSchema.safeParse(body);
    if (!parseResult.success) {
      throw new BadRequestException({
        success: false,
        error: {
          code: "INVALID_VENUE_DATA",
          message: "Dữ liệu tạo địa điểm không hợp lệ",
          details: parseResult.error.format(),
          timestamp: new Date().toISOString(),
        },
      });
    }

    const data = await mapVenueErrors(() =>
      this.venueCommands.createVenue(parseResult.data),
    );
    return {
      success: true,
      data,
    };
  }

  @Put(":id")
  @HttpCode(HttpStatus.OK)
  async updateVenue(
    @Param("id", ParseUUIDPipe) id: string,
    @Body() body: unknown,
  ) {
    const parseResult = UpdateVenueSchema.safeParse(body);
    if (!parseResult.success) {
      throw new BadRequestException({
        success: false,
        error: {
          code: "INVALID_VENUE_UPDATE_DATA",
          message: "Dữ liệu cập nhật địa điểm không hợp lệ",
          details: parseResult.error.format(),
          timestamp: new Date().toISOString(),
        },
      });
    }

    const data = await mapVenueErrors(() =>
      this.venueCommands.updateVenue(id, parseResult.data),
    );
    return {
      success: true,
      data,
    };
  }

  @Post(":id/layouts")
  @HttpCode(HttpStatus.CREATED)
  async createVenueLayout(
    @Param("id", ParseUUIDPipe) id: string,
    @Body() body: unknown,
  ) {
    const parseResult = CreateVenueLayoutSchema.safeParse(body);
    if (!parseResult.success) {
      throw new BadRequestException({
        success: false,
        error: {
          code: "INVALID_VENUE_LAYOUT_DATA",
          message: "Dữ liệu mẫu sơ đồ không hợp lệ",
          details: parseResult.error.format(),
          timestamp: new Date().toISOString(),
        },
      });
    }

    const data = await mapVenueErrors(() =>
      this.venueCommands.createVenueLayout(id, parseResult.data),
    );
    return {
      success: true,
      data,
    };
  }
}
