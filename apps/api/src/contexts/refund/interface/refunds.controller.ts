import {
  BadRequestException,
  Body,
  ConflictException,
  Controller,
  ForbiddenException,
  Headers,
  Inject,
  NotFoundException,
  Post,
  UseGuards,
} from "@nestjs/common";
import type {
  RefundExecuteRequest,
  RefundExecuteResponse,
  RefundPreviewRequest,
  RefundPreviewResponse,
} from "@tickethub/shared";
import { JwtAuthGuard } from "../../identity/interface/guards/jwt-auth.guard";
import {
  CurrentUser,
  type AuthenticatedUser,
} from "../../identity/interface/decorators/current-user.decorator";
import { PreviewRefundUseCase } from "../application/preview-refund.use-case";
import { RequestRefundUseCase } from "../application/request-refund.use-case";
import { RefundDomainError } from "../domain/refund.errors";

function toHttpException(err: RefundDomainError): Error {
  switch (err.kind) {
    case "NOT_FOUND":
      return new NotFoundException(err.message);
    case "FORBIDDEN":
      return new ForbiddenException(err.message);
    case "CONFLICT":
      return new ConflictException(err.message);
    default:
      return new BadRequestException(err.message);
  }
}

async function mapDomainErrors<T>(work: () => Promise<T>): Promise<T> {
  try {
    return await work();
  } catch (err) {
    if (err instanceof RefundDomainError) throw toHttpException(err);
    throw err;
  }
}

@Controller("api/v1/refund")
@UseGuards(JwtAuthGuard)
export class RefundsController {
  constructor(
    @Inject(PreviewRefundUseCase)
    private readonly previewRefund: PreviewRefundUseCase,
    @Inject(RequestRefundUseCase)
    private readonly requestRefund: RequestRefundUseCase,
  ) {}

  @Post("preview")
  async preview(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: RefundPreviewRequest,
  ): Promise<RefundPreviewResponse> {
    return mapDomainErrors(() =>
      this.previewRefund.execute(
        { userId: user.userId, role: user.role },
        body,
      ),
    );
  }

  @Post("request")
  async request(
    @CurrentUser() user: AuthenticatedUser,
    @Headers("idempotency-key") idempotencyKey: string,
    @Body() body: RefundExecuteRequest,
  ): Promise<RefundExecuteResponse> {
    if (!idempotencyKey || idempotencyKey.trim() === "") {
      throw new BadRequestException("Missing Idempotency-Key header");
    }
    return mapDomainErrors(() =>
      this.requestRefund.execute(
        { userId: user.userId, role: user.role },
        body,
        idempotencyKey.trim(),
      ),
    );
  }
}
