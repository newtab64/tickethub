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

import {
  ConfirmImageSchema,
  PresignImageSchema,
  UserRole,
} from "@tickethub/shared";

import { JwtAuthGuard } from "../../identity/interface/guards/jwt-auth.guard";
import { RolesGuard } from "../../identity/interface/guards/roles.guard";
import { Roles } from "../../identity/interface/decorators/roles.decorator";

import {
  CurrentUser,
  type AuthenticatedUser,
} from "../../identity/interface/decorators/current-user.decorator";

import { ConfirmEventImageUseCase } from "../application/confirm-event-image.use-case";
import { PresignEventImageUseCase } from "../application/presign-event-image.use-case";
import { mapUploadErrors } from "./upload-http";

@Controller("api/v1/uploads")
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ORGANIZER)
export class UploadsController {
  constructor(
    @Inject(PresignEventImageUseCase)
    private readonly presignImage: PresignEventImageUseCase,
    @Inject(ConfirmEventImageUseCase)
    private readonly confirmImage: ConfirmEventImageUseCase,
  ) {}

  @Post("event-image/presign")
  @HttpCode(HttpStatus.OK)
  async presignEventImage(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: unknown,
  ) {
    const result = PresignImageSchema.safeParse(body);

    if (!result.success) {
      throw new BadRequestException({
        success: false,
        error: {
          code: "VALIDATION_ERROR",
          message: "Dữ liệu yêu cầu tải ảnh không hợp lệ",
          details: result.error.format(),
          timestamp: new Date().toISOString(),
        },
      });
    }

    const data = await mapUploadErrors(() =>
      this.presignImage.execute(user.userId, result.data),
    );

    return {
      success: true,
      data,
    };
  }

  @Post("event-image/confirm")
  @HttpCode(HttpStatus.OK)
  async confirmEventImage(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: unknown,
  ) {
    const result = ConfirmImageSchema.safeParse(body);

    if (!result.success) {
      throw new BadRequestException({
        success: false,
        error: {
          code: "VALIDATION_ERROR",
          message: "Khóa tập tin xác nhận không hợp lệ",
          details: result.error.format(),
          timestamp: new Date().toISOString(),
        },
      });
    }

    const data = await mapUploadErrors(() =>
      this.confirmImage.execute(user.userId, result.data.key),
    );

    return {
      success: true,
      data,
    };
  }
}
