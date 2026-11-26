import {
  Controller,
  Get,
  Param,
  Query,
  UseGuards,
  BadRequestException,
  Inject,
} from "@nestjs/common";
import { BuyerTicketService } from "../application/buyer-ticket.service";
import { mapTicketingErrors } from "./ticketing-http";
import { JwtAuthGuard } from "../../identity/interface/guards/jwt-auth.guard";
import { RolesGuard } from "../../identity/interface/guards/roles.guard";
import { Roles } from "../../identity/interface/decorators/roles.decorator";
import {
  CurrentUser,
  AuthenticatedUser,
} from "../../identity/interface/decorators/current-user.decorator";
import { MyTicketsQuerySchema, UserRole } from "@tickethub/shared";

@Controller("api/v1/tickets")
@UseGuards(JwtAuthGuard, RolesGuard)
export class TicketsController {
  constructor(
    @Inject(BuyerTicketService)
    private readonly buyerTickets: BuyerTicketService,
  ) {}

  @Get("my-tickets")
  @Roles(UserRole.BUYER, UserRole.ADMIN)
  async getMyTickets(
    @CurrentUser() user: AuthenticatedUser,
    @Query() rawQuery: Record<string, unknown>,
  ) {
    const parseResult = MyTicketsQuerySchema.safeParse(rawQuery);
    if (!parseResult.success) {
      throw new BadRequestException({
        success: false,
        error: {
          code: "VALIDATION_ERROR",
          message: "Tham số truy vấn vé cá nhân không hợp lệ",
          details: parseResult.error.format(),
          timestamp: new Date().toISOString(),
        },
      });
    }

    const data = await mapTicketingErrors(() =>
      this.buyerTickets.getMyTickets(user.userId, parseResult.data),
    );

    return {
      success: true,
      data: data.items,
      meta: data.meta,
    };
  }

  @Get(":id/qr")
  @Roles(UserRole.BUYER, UserRole.ADMIN)
  async getQrToken(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id") id: string,
  ) {
    return mapTicketingErrors(() =>
      this.buyerTickets.getTicketQr(user.userId, user.role, id),
    );
  }
}
