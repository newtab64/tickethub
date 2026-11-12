import {
  Controller,
  Inject,
  Post,
  Get,
  Body,
  Req,
  Res,
  UseGuards,
  HttpCode,
  HttpStatus,
  BadRequestException,
} from "@nestjs/common";
import { FastifyRequest, FastifyReply } from "fastify";
import {
  IDENTITY_USE_CASES,
  type IdentityUseCases,
} from "../application/identity-use-cases";
import { mapIdentityErrors } from "./identity-http";
import { JwtAuthGuard } from "./guards/jwt-auth.guard";
import {
  CurrentUser,
  AuthenticatedUser,
} from "./decorators/current-user.decorator";
import {
  RegisterRequestSchema,
  LoginRequestSchema,
  VerifyEmailRequestSchema,
} from "@tickethub/shared";

@Controller("api/v1/auth")
export class AuthController {
  constructor(
    @Inject(IDENTITY_USE_CASES) private readonly identity: IdentityUseCases,
  ) {}

  @Post("check-identifier")
  @HttpCode(HttpStatus.OK)
  async checkIdentifier(@Body() body: Record<string, unknown>) {
    const raw =
      typeof body?.identifier === "string"
        ? body.identifier
        : typeof body?.email === "string"
          ? body.email
          : "";
    const exists = await this.identity.checkIdentifier.execute(raw);
    return {
      success: true,
      data: {
        exists,
        methods: ["password"],
      },
    };
  }

  @Post("register")
  @HttpCode(HttpStatus.CREATED)
  async register(@Body() body: unknown) {
    const parseResult = RegisterRequestSchema.safeParse(body);
    if (!parseResult.success) {
      throw new BadRequestException({
        success: false,
        error: {
          code: "VALIDATION_ERROR",
          message: "Dữ liệu đăng ký không hợp lệ",
          details: parseResult.error.format(),
          timestamp: new Date().toISOString(),
        },
      });
    }

    const data = await mapIdentityErrors(() =>
      this.identity.register.execute(parseResult.data),
    );
    return {
      success: true,
      data: {
        userId: data.userId,
        email: data.email,
        status: data.status,
        message: data.message,
      },
    };
  }

  @Post("verify-email")
  @HttpCode(HttpStatus.OK)
  async verifyEmail(@Body() body: unknown) {
    const parseResult = VerifyEmailRequestSchema.safeParse(body);
    if (!parseResult.success) {
      throw new BadRequestException({
        success: false,
        error: {
          code: "VALIDATION_ERROR",
          message: "Mã token xác thực là bắt buộc",
          timestamp: new Date().toISOString(),
        },
      });
    }

    const data = await mapIdentityErrors(() =>
      this.identity.verifyEmail.execute(parseResult.data.token),
    );
    return {
      success: true,
      data,
    };
  }

  @Post("login")
  @HttpCode(HttpStatus.OK)
  async login(
    @Body() body: unknown,
    @Res({ passthrough: true }) res: FastifyReply,
  ) {
    const parseResult = LoginRequestSchema.safeParse(body);
    if (!parseResult.success) {
      throw new BadRequestException({
        success: false,
        error: {
          code: "VALIDATION_ERROR",
          message: "Email hoặc mật khẩu không đúng định dạng",
          timestamp: new Date().toISOString(),
        },
      });
    }

    const result = await mapIdentityErrors(() =>
      this.identity.login.execute(parseResult.data),
    );

    // Gán cookie HttpOnly cho Refresh Token
    res.setCookie("refreshToken", result.refreshToken, {
      path: "/",
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 ngày
    });

    return {
      success: true,
      data: {
        accessToken: result.accessToken,
        expiresIn: result.expiresIn,
        user: result.user,
      },
    };
  }

  @Post("refresh")
  @HttpCode(HttpStatus.OK)
  async refresh(
    @Req() req: FastifyRequest,
    @Body() body: { refreshToken?: string },
    @Res({ passthrough: true }) res: FastifyReply,
  ) {
    const tokenFromCookie = req.cookies?.refreshToken;
    const token = tokenFromCookie || body?.refreshToken;

    if (!token) {
      throw new BadRequestException({
        success: false,
        error: {
          code: "MISSING_REFRESH_TOKEN",
          message: "Không tìm thấy refresh token trong cookie hoặc body",
          timestamp: new Date().toISOString(),
        },
      });
    }

    const result = await mapIdentityErrors(() =>
      this.identity.refresh.execute(token),
    );

    res.setCookie("refreshToken", result.refreshToken, {
      path: "/",
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    return {
      success: true,
      data: {
        accessToken: result.accessToken,
        expiresIn: result.expiresIn,
      },
    };
  }

  @Post("logout")
  @HttpCode(HttpStatus.OK)
  async logout(@Res({ passthrough: true }) res: FastifyReply) {
    res.clearCookie("refreshToken", { path: "/" });
    return {
      success: true,
      data: {
        message: "Đăng xuất thành công",
      },
    };
  }

  @Get("me")
  @UseGuards(JwtAuthGuard)
  async getMe(@CurrentUser() user: AuthenticatedUser) {
    const data = await mapIdentityErrors(() =>
      this.identity.currentUser.execute(user.userId),
    );
    return {
      success: true,
      data,
    };
  }
}
