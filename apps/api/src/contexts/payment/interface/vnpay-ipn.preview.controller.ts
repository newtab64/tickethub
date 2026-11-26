import {
  BadRequestException,
  Controller,
  Get,
  Inject,
  NotFoundException,
  Query,
} from "@nestjs/common";

import { PreviewVnpayIpnUseCase } from "../application/preview-vnpay-ipn.use-case";

@Controller("api/v1/internal/vnpay")
export class VnpayIpnPreviewController {
  constructor(
    @Inject(PreviewVnpayIpnUseCase)
    private readonly previewService: PreviewVnpayIpnUseCase,
  ) {}

  @Get("ipn-preview")
  async inspect(@Query() query: Record<string, unknown>) {
    if (
      process.env.NODE_ENV === "production" ||
      process.env.ENABLE_VNPAY_IPN_PREVIEW !== "true"
    ) {
      throw new NotFoundException();
    }

    const params: Record<string, string> = {};

    for (const [key, value] of Object.entries(query)) {
      if (!key.startsWith("vnp_")) continue;

      if (typeof value !== "string") {
        throw new BadRequestException(`Invalid VNPay parameter: ${key}`);
      }

      params[key] = value;
    }

    if (!params.vnp_SecureHash) {
      throw new BadRequestException("Missing VNPay secure hash");
    }

    const decision = await this.previewService.inspect(params);

    return {
      mode: "READ_ONLY",
      decision,
      databaseUpdated: false,
    };
  }
}
