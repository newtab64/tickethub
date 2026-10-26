import {
  Controller,
  Post,
  Param,
  UseGuards,
  Res,
  HttpStatus,
  SetMetadata,
  Inject,
} from "@nestjs/common";

import type { FastifyReply } from "fastify";

import { WaitingRoomService } from "./waiting-room.service";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";

import {
  CurrentUser,
  AuthenticatedUser,
} from "../auth/decorators/current-user.decorator";

import {
  WaitingRoomRateLimitGuard,
  WAITING_ROOM_RATE_ACTION,
} from "./guards/waiting-room-rate-limit.guard";

@Controller("api/v1/waiting-room")
@UseGuards(JwtAuthGuard, WaitingRoomRateLimitGuard)
export class WaitingRoomController {
  constructor(
    @Inject(WaitingRoomService)
    private readonly waitingRoomService: WaitingRoomService,
  ) {}

  // ==========================================
  // API 1: JOIN WAITING ROOM
  // POST /api/v1/waiting-room/:eventId/join
  // Rate Limit: 20 requests / minute / IP
  // ==========================================

  @SetMetadata(WAITING_ROOM_RATE_ACTION, "join")
  @Post(":eventId/join")
  async joinQueue(
    @CurrentUser() user: AuthenticatedUser,
    @Param("eventId") eventId: string,
    @Res({ passthrough: true }) res: FastifyReply,
  ) {
    const result = await this.waitingRoomService.joinQueue(
      user.userId,
      eventId,
    );

    if (result.status === "QUEUED") {
      res.status(HttpStatus.ACCEPTED);
    } else {
      res.status(HttpStatus.OK);
    }

    return {
      success: true,
      data: result,
    };
  }

  // ==========================================
  // API 2: HEARTBEAT WAITING ROOM
  // POST /api/v1/waiting-room/:eventId/heartbeat
  // Rate Limit: 600 requests / minute / IP
  // ==========================================

  @SetMetadata(WAITING_ROOM_RATE_ACTION, "heartbeat")
  @Post(":eventId/heartbeat")
  async heartbeat(
    @CurrentUser() user: AuthenticatedUser,
    @Param("eventId") eventId: string,
    @Res({ passthrough: true }) res: FastifyReply,
  ) {
    const result = await this.waitingRoomService.heartbeat(
      user.userId,
      eventId,
    );

    if (result.status === "QUEUED") {
      res.status(HttpStatus.ACCEPTED);
    } else {
      res.status(HttpStatus.OK);
    }

    return {
      success: true,
      data: result,
    };
  }
}
