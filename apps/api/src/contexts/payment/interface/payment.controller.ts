import {
  Controller,
  Post,
  Param,
  ParseUUIDPipe,
  Ip,
  Inject,
  UseGuards,
} from "@nestjs/common";

import { JwtAuthGuard } from "../../identity/interface/guards/jwt-auth.guard";
import {
  CurrentUser,
  AuthenticatedUser,
} from "../../identity/interface/decorators/current-user.decorator";

import { CreateVnpayPaymentUseCase } from "../application/create-vnpay-payment.use-case";
import { mapPaymentErrors } from "./payment-http";

@Controller("api/v1/payments")
@UseGuards(JwtAuthGuard)
export class PaymentController {
  constructor(
    @Inject(CreateVnpayPaymentUseCase)
    private readonly createPaymentUseCase: CreateVnpayPaymentUseCase,
  ) {}

  @Post("orders/:orderId/vnpay")
  async createPayment(
    @CurrentUser() user: AuthenticatedUser,
    @Param("orderId", new ParseUUIDPipe()) orderId: string,
    @Ip() clientIp: string,
  ) {
    const data = await mapPaymentErrors(() =>
      this.createPaymentUseCase.execute(user.userId, orderId, clientIp),
    );

    return {
      success: true,
      data,
    };
  }
}
