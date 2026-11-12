import {
  BadRequestException,
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Inject,
  Post,
  UseGuards,
} from "@nestjs/common";
import { GateCheckInService } from "../application/gate-checkin.service";
import { mapTicketingErrors } from "./ticketing-http";
import { JwtAuthGuard } from "../../identity/interface/guards/jwt-auth.guard";
import { RolesGuard } from "../../identity/interface/guards/roles.guard";
import { Roles } from "../../identity/interface/decorators/roles.decorator";
import {
  CurrentUser,
  AuthenticatedUser,
} from "../../identity/interface/decorators/current-user.decorator";
import {
  GateLookupRequestSchema,
  GateScanRequestSchema,
  UserRole,
} from "@tickethub/shared";

@Controller("api/v1/gate")
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.GATE_STAFF, UserRole.ADMIN)
export class GateController {
  constructor(
    @Inject(GateCheckInService) private readonly gate: GateCheckInService,
  ) {}

  @Post("scan")
  @HttpCode(HttpStatus.OK)
  async scanTicket(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: unknown,
  ) {
    const parseResult = GateScanRequestSchema.safeParse(body);
    if (!parseResult.success) {
      throw new BadRequestException({
        success: false,
        error: {
          code: "VALIDATION_ERROR",
          message: "Dữ liệu quét mã QR không hợp lệ",
          details: parseResult.error.format(),
          timestamp: new Date().toISOString(),
        },
      });
    }

    return mapTicketingErrors(() =>
      this.gate.scanTicket(user.userId, user.role, parseResult.data),
    );
  }

  @Post("lookup")
  @HttpCode(HttpStatus.OK)
  async lookupTicket(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: unknown,
  ) {
    const parseResult = GateLookupRequestSchema.safeParse(body);
    if (!parseResult.success) {
      throw new BadRequestException({
        success: false,
        error: {
          code: "VALIDATION_ERROR",
          message: "Dữ liệu tra cứu vé thủ công không hợp lệ",
          details: parseResult.error.format(),
          timestamp: new Date().toISOString(),
        },
      });
    }

    return mapTicketingErrors(() =>
      this.gate.lookupTicket(user.userId, user.role, parseResult.data),
    );
  }
}
