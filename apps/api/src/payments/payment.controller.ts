import {
  Controller,
  Post,
  Param,
  ParseUUIDPipe,
  Ip,
  Inject,
  UseGuards,
  Headers,
  BadRequestException,
} from "@nestjs/common";

import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import {
  CurrentUser,
  AuthenticatedUser,
} from "../auth/decorators/current-user.decorator";

import { PaymentService } from "./payment.service";

import { RolesGuard } from "../auth/guards/roles.guard";
import { Roles } from "../auth/decorators/roles.decorator";
import { UserRole } from "@tickethub/shared";

@Controller("api/v1/payments")
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.BUYER)
export class PaymentController {
  constructor(
    @Inject(PaymentService)
    private readonly paymentService: PaymentService,
  ) {}

  @Post("orders/:orderId/vnpay")
  async createPayment(
    @CurrentUser() user: AuthenticatedUser,
    @Param("orderId", new ParseUUIDPipe()) orderId: string,
    @Ip() clientIp: string,
    @Headers("idempotency-key") idempotencyKey?: string,
  ) {
    if (!idempotencyKey || !/^[A-Za-z0-9_-]{8,100}$/.test(idempotencyKey)) {
      throw new BadRequestException("Valid Idempotency-Key is required");
    }

    const data = await this.paymentService.createVnpayPayment(
      user.userId,
      orderId,
      clientIp,
      idempotencyKey,
    );

    return { success: true, data };
  }
}
