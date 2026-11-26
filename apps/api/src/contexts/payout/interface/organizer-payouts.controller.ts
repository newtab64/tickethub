import {
  Controller,
  Get,
  Query,
  UseGuards,
  BadRequestException,
  HttpCode,
  HttpStatus,
  Inject,
} from "@nestjs/common";
import { PayoutQueries } from "../application/payout-queries.service";
import { mapPayoutErrors } from "./payout-http";
import { JwtAuthGuard } from "../../identity/interface/guards/jwt-auth.guard";
import { RolesGuard } from "../../identity/interface/guards/roles.guard";
import { Roles } from "../../identity/interface/decorators/roles.decorator";
import {
  CurrentUser,
  AuthenticatedUser,
} from "../../identity/interface/decorators/current-user.decorator";
import { UserRole, OrganizerPayoutQuerySchema } from "@tickethub/shared";

@Controller("api/v1/organizer/payouts")
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ORGANIZER)
export class OrganizerPayoutsController {
  constructor(
    @Inject(PayoutQueries) private readonly payoutQueries: PayoutQueries,
  ) {}

  // GET /api/v1/organizer/payouts
  // Danh sach quyet toan danh cho ban to chuc
  @Get()
  @HttpCode(HttpStatus.OK)
  async getOrganizerPayouts(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: unknown,
  ) {
    const parseResult = OrganizerPayoutQuerySchema.safeParse(query);
    if (!parseResult.success) {
      throw new BadRequestException({
        success: false,
        error: {
          code: "INVALID_QUERY_PARAMS",
          message: "Tham số truy vấn quyết toán không hợp lệ",
          details: parseResult.error.format(),
          timestamp: new Date().toISOString(),
        },
      });
    }

    const data = await mapPayoutErrors(() =>
      this.payoutQueries.getOrganizerPayouts(user.userId, parseResult.data),
    );

    return {
      success: true,
      data,
    };
  }
}
