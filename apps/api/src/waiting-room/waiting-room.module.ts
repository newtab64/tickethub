import { Module } from "@nestjs/common";
import { WaitingRoomController } from "./waiting-room.controller";
import { WaitingRoomService } from "./waiting-room.service";
import { AuthModule } from "../auth/auth.module";
import { WaitingRoomMaintenanceTask } from "./waiting-room-maintenance.task";
import { WaitingRoomRateLimitGuard } from "./guards/waiting-room-rate-limit.guard";
@Module({
  imports: [AuthModule],
  controllers: [WaitingRoomController],
  providers: [
    WaitingRoomService,
    WaitingRoomMaintenanceTask,
    WaitingRoomRateLimitGuard,
  ],
  exports: [WaitingRoomService],
})
export class WaitingRoomModule {}
