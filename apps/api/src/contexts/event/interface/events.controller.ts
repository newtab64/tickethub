import {
  Inject,
  ParseUUIDPipe,
  Controller,
  Post,
  Get,
  Put,
  Param,
  Query,
  Body,
  UseGuards,
  HttpCode,
  HttpStatus,
  BadRequestException,
  Sse,
  Req,
  MessageEvent,
} from "@nestjs/common";
import type { FastifyRequest } from "fastify";
import type { Observable } from "rxjs";
import { SeatStreamService } from "../infrastructure/seat-stream.service";
import type { GenerateSeatsDto, UpdateEventDto } from "../domain/event.models";
import { OrganizerEventService } from "../application/organizer-event.service";
import { PublicEventService } from "../application/public-event.service";
import { EventReadModel } from "../application/event-read-model";
import { mapEventErrors } from "./event-http";
import { JwtAuthGuard } from "../../identity/interface/guards/jwt-auth.guard";
import { RolesGuard } from "../../identity/interface/guards/roles.guard";
import { Roles } from "../../identity/interface/decorators/roles.decorator";
import {
  CurrentUser,
  AuthenticatedUser,
} from "../../identity/interface/decorators/current-user.decorator";
import {
  UserRole,
  CreateEventRequestSchema,
  EventFilterQuerySchema,
} from "@tickethub/shared";
@Controller("api/v1/organizer/events")
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ORGANIZER, UserRole.ADMIN)
export class OrganizerEventsController {
  constructor(
    @Inject(OrganizerEventService)
    private readonly organizerEvents: OrganizerEventService,
  ) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async createEvent(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: unknown,
  ) {
    const parseResult = CreateEventRequestSchema.safeParse(body);
    if (!parseResult.success) {
      throw new BadRequestException({
        success: false,
        error: {
          code: "VALIDATION_ERROR",
          message: "Dữ liệu tạo sự kiện không hợp lệ",
          details: parseResult.error.format(),
          timestamp: new Date().toISOString(),
        },
      });
    }

    const data = await mapEventErrors(() =>
      this.organizerEvents.createEvent(user.userId, parseResult.data),
    );
    return {
      success: true,
      data,
    };
  }

  @Get()
  async getOrganizerEvents(@CurrentUser() user: AuthenticatedUser) {
    const data = await mapEventErrors(() =>
      this.organizerEvents.getOrganizerEvents(user.userId),
    );
    return {
      success: true,
      data: {
        items: data,
        total: data.length,
      },
    };
  }

  @Get(":id")
  async getOrganizerEventById(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id") id: string,
  ) {
    const data = await mapEventErrors(() =>
      this.organizerEvents.getOrganizerEventById(user.userId, id),
    );
    return {
      success: true,
      data,
    };
  }

  @Put(":id")
  async updateEvent(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id") id: string,
    @Body() body: UpdateEventDto,
  ) {
    if (typeof body?.version !== "number") {
      throw new BadRequestException({
        success: false,
        error: {
          code: "VERSION_REQUIRED",
          message: "Trường version là bắt buộc để kiểm soát tranh chấp dữ liệu",
          timestamp: new Date().toISOString(),
        },
      });
    }

    const data = await mapEventErrors(() =>
      this.organizerEvents.updateEvent(user.userId, id, body),
    );
    return {
      success: true,
      data,
    };
  }

  @Post(":id/seats/generate")
  @HttpCode(HttpStatus.OK)
  async generateSeats(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id") id: string,
    @Body() body: GenerateSeatsDto,
  ) {
    if (!body?.zones || !Array.isArray(body.zones) || body.zones.length === 0) {
      throw new BadRequestException({
        success: false,
        error: {
          code: "INVALID_ZONE_CONFIG",
          message: "Danh sách cấu hình khu vực ghế không hợp lệ",
          timestamp: new Date().toISOString(),
        },
      });
    }

    const data = await mapEventErrors(() =>
      this.organizerEvents.generateSeats(user.userId, id, body),
    );
    return {
      success: true,
      data,
    };
  }

  @Post(":id/submit")
  @HttpCode(HttpStatus.OK)
  async submitEvent(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id") id: string,
  ) {
    const data = await mapEventErrors(() =>
      this.organizerEvents.submitEventForApproval(user.userId, id),
    );
    return {
      success: true,
      data,
    };
  }
}

@Controller("api/v1/events")
export class PublicEventsController {
  constructor(
    @Inject(PublicEventService)
    private readonly publicEvents: PublicEventService,

    @Inject(EventReadModel)
    private readonly readModel: EventReadModel,

    @Inject(SeatStreamService)
    private readonly seatStreamService: SeatStreamService,
  ) {}

  // GET /api/v1/events/:id/seats/stream
  // Luong Server-Sent Events cap nhat trang thai ghe thoi gian thuc
  @Get(":id/seats/stream")
  @Sse(":id/seats/stream")
  streamSeats(
    @Param("id", ParseUUIDPipe) id: string,
    @Req() req: FastifyRequest,
  ): Observable<MessageEvent> {
    return this.seatStreamService.createSeatStream(id, req?.raw?.signal);
  }

  // GET /api/v1/events
  // Lay danh sach su kien cong khai
  @Get()
  async getPublicEvents(@Query() query: unknown) {
    const parseResult = EventFilterQuerySchema.safeParse(query);

    const filters = parseResult.success ? parseResult.data : {};

    const items = await mapEventErrors(() =>
      this.publicEvents.getPublicEvents(filters),
    );

    return {
      success: true,
      data: {
        items,
        total: items.length,
      },
    };
  }

  // GET /api/v1/events/:id/seatmap
  // Lay so do ghe qua Redis Cache, TTL 60 giay
  @Get(":id/seatmap")
  async getEventSeatMap(@Param("id", ParseUUIDPipe) id: string) {
    const data = await mapEventErrors(() => this.readModel.getSeatMap(id));

    return {
      success: true,
      data,
    };
  }

  // GET /api/v1/events/:id/inventory
  // Lay ton kho ve qua Redis Cache, TTL 60 giay
  @Get(":id/inventory")
  async getEventInventory(@Param("id", ParseUUIDPipe) id: string) {
    const data = await mapEventErrors(() => this.readModel.getInventory(id));

    return {
      success: true,
      data,
    };
  }

  // GET /api/v1/events/:slug
  // Lay chi tiet su kien bang slug
  @Get(":slug")
  async getPublicEventBySlug(@Param("slug") slug: string) {
    const data = await mapEventErrors(() =>
      this.publicEvents.getPublicEventBySlug(slug),
    );

    return {
      success: true,
      data,
    };
  }
}
