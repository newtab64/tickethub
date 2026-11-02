import {
  Inject,
  Injectable,
  OnModuleInit,
  OnModuleDestroy,
  Logger,
} from "@nestjs/common";
import { BookingService } from "./booking.service";

@Injectable()
export class BookingCleanupTask implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(BookingCleanupTask.name);
  private timer: NodeJS.Timeout | null = null;

  constructor(
    @Inject(BookingService) private readonly bookingService: BookingService,
  ) {}

  onModuleInit() {
    // Quét dọn các đơn hàng và ghế hết hạn định kỳ mỗi 15 giây
    this.timer = setInterval(async () => {
      try {
        const { expiredOrdersCount } =
          await this.bookingService.cleanExpiredOrders();
        if (expiredOrdersCount > 0) {
          this.logger.log(
            `Đã tự động thu hồi ${expiredOrdersCount} đơn hàng và giải phóng ghế hết hạn.`,
          );
        }
      } catch (error) {
        this.logger.error("Lỗi khi thực hiện dọn dẹp đơn hàng hết hạn", error);
      }
    }, 15000);
  }

  onModuleDestroy() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }
}
