import {
  Controller,
  Get,
  Param,
  Query,
  UseGuards,
  BadRequestException,
  Inject,
} from "@nestjs/common";
import { BuyerOrderQueries } from "../application/buyer-order-queries.service";
import { mapBookingErrors } from "./booking-http";
import { JwtAuthGuard } from "../../identity/interface/guards/jwt-auth.guard";
import { RolesGuard } from "../../identity/interface/guards/roles.guard";
import { Roles } from "../../identity/interface/decorators/roles.decorator";
import {
  CurrentUser,
  AuthenticatedUser,
} from "../../identity/interface/decorators/current-user.decorator";
import { BuyerOrderQuerySchema, UserRole } from "@tickethub/shared";

@Controller("api/v1/buyer/orders")
@UseGuards(JwtAuthGuard, RolesGuard)
export class BuyerOrderController {
  constructor(
    @Inject(BuyerOrderQueries)
    private readonly buyerOrders: BuyerOrderQueries,
  ) {}

  @Get()
  @Roles(UserRole.BUYER, UserRole.ADMIN)
  async listOrders(
    @CurrentUser() user: AuthenticatedUser,
    @Query() rawQuery: Record<string, unknown>,
  ) {
    const parseResult = BuyerOrderQuerySchema.safeParse(rawQuery);
    if (!parseResult.success) {
      throw new BadRequestException({
        success: false,
        error: {
          code: "VALIDATION_ERROR",
          message: "Tham số truy vấn đơn hàng không hợp lệ",
          details: parseResult.error.format(),
          timestamp: new Date().toISOString(),
        },
      });
    }

    const data = await mapBookingErrors(() =>
      this.buyerOrders.listBuyerOrders(user.userId, parseResult.data),
    );

    return {
      success: true,
      data: data.items,
      meta: data.meta,
    };
  }

  @Get(":id")
  @Roles(UserRole.BUYER, UserRole.ADMIN)
  async getOrderDetail(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id") id: string,
  ) {
    const data = await mapBookingErrors(() =>
      this.buyerOrders.getBuyerOrderDetail(user.userId, user.role, id),
    );

    return {
      success: true,
      data,
    };
  }
}
