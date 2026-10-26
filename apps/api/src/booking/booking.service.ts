import {
  Inject,
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
  ForbiddenException,
} from "@nestjs/common";
import { sql, eq, and, or, lt, inArray, asc } from "drizzle-orm";
import crypto from "crypto";
import { db } from "../database/db";
import {
  orders,
  orderItems,
  seats,
  ticketTypes,
  events,
  outbox,
} from "../database/schema";
import {
  HoldSeatsRequest,
  OrderStatus,
  OutboxStatus,
  EventStatus,
  SeatStatus,
} from "@tickethub/shared";
import { WaitingRoomService } from "../waiting-room/waiting-room.service";
import { EventReadCacheService } from "../events/event-read-cache.service";
@Injectable()
export class BookingService {
  constructor(
    @Inject(WaitingRoomService)
    private readonly waitingRoomService: WaitingRoomService,

    @Inject(EventReadCacheService)
    private readonly eventReadCacheService: EventReadCacheService,
  ) {}

  async holdSeats(
    userId: string,
    dto: HoldSeatsRequest,
    admissionToken?: string,
  ) {
    const event = await db.query.events.findFirst({
      where: eq(events.id, dto.eventId),
    });

    if (!event) {
      throw new NotFoundException({
        success: false,
        error: {
          code: "EVENT_NOT_FOUND",
          message: "Không tìm thấy sự kiện",
          timestamp: new Date().toISOString(),
        },
      });
    }

    if (event.status !== EventStatus.PUBLISHED) {
      throw new BadRequestException({
        success: false,
        error: {
          code: "EVENT_NOT_PUBLISHED",
          message: "Sự kiện chưa mở bán vé hoặc đã kết thúc",
          timestamp: new Date().toISOString(),
        },
      });
    }

    // Kiểm tra hàng chờ ảo nếu sự kiện yêu cầu
    if (event.isWaitingRoomEnabled) {
      if (!admissionToken) {
        throw new ForbiddenException({
          success: false,
          error: {
            code: "MISSING_ADMISSION_TOKEN",
            message:
              "Sự kiện đang bật hàng chờ ảo, yêu cầu header X-Admission-Token",
            timestamp: new Date().toISOString(),
          },
        });
      }

      const isValidToken = await this.waitingRoomService.verifyAdmissionToken(
        admissionToken,
        dto.eventId,
        userId,
      );

      if (!isValidToken) {
        throw new ForbiddenException({
          success: false,
          error: {
            code: "INVALID_ADMISSION_TOKEN",
            message:
              "Mã lượt hàng chờ ảo không hợp lệ hoặc đã hết hạn (X-Admission-Token)",
            timestamp: new Date().toISOString(),
          },
        });
      }
    }

    // Kiểm tra tổng số lượng vé đặt (tối đa 6 vé)
    const totalQuantity = dto.items.reduce(
      (sum, item) => sum + (item.quantity ?? 1),
      0,
    );
    if (totalQuantity > 6) {
      throw new BadRequestException({
        success: false,
        error: {
          code: "MAX_TICKETS_EXCEEDED",
          message: "Số lượng vé tối đa trên mỗi đơn hàng là 6 vé",
          timestamp: new Date().toISOString(),
        },
      });
    }

    // Phân loại ghế ngồi và vé đứng
    const seatedItems = dto.items.filter((i) => Boolean(i.seatId));
    const standingItems = dto.items.filter((i) => !i.seatId);

    const seatIds = seatedItems.map((i) => i.seatId!);
    if (new Set(seatIds).size !== seatIds.length) {
      throw new BadRequestException({
        success: false,
        error: {
          code: "DUPLICATE_SEATS",
          message: "Danh sách ghế yêu cầu chứa vị trí trùng lặp",
          timestamp: new Date().toISOString(),
        },
      });
    }

    // Sắp xếp ID ghế tăng dần để loại trừ deadlock
    const sortedSeatIds = [...seatIds].sort();

    const result = await db.transaction(async (tx) => {
      // 1. Khóa và cập nhật ghế ngồi
      if (sortedSeatIds.length > 0) {
        // Khóa các dòng ghế theo thứ tự ID tăng dần
        const lockedSeats = await tx
          .select({
            id: seats.id,
            status: seats.status,
            ticketTypeId: seats.ticketTypeId,
          })
          .from(seats)
          .where(
            and(
              inArray(seats.id, sortedSeatIds),
              eq(seats.eventId, dto.eventId),
            ),
          )
          .orderBy(asc(seats.id))
          .for("update");

        if (lockedSeats.length < sortedSeatIds.length) {
          throw new NotFoundException({
            success: false,
            error: {
              code: "SEAT_NOT_FOUND",
              message: "Một số ghế yêu cầu không tồn tại trong sự kiện",
              timestamp: new Date().toISOString(),
            },
          });
        }
        // Kiem tra ghe co dung hang ve da chon khong.
        const seatTypeById = new Map(
          lockedSeats.map((seat) => [seat.id, seat.ticketTypeId]),
        );

        for (const item of seatedItems) {
          if (
            (item.quantity ?? 1) !== 1 ||
            seatTypeById.get(item.seatId!) !== item.ticketTypeId
          ) {
            throw new BadRequestException({
              success: false,
              error: {
                code: "SEAT_TICKET_TYPE_MISMATCH",
                message:
                  "Ghế không thuộc hạng vé đã chọn hoặc số lượng không hợp lệ",
                timestamp: new Date().toISOString(),
              },
            });
          }
        }

        const now = new Date();
        const holdExpiresAt = new Date(now.getTime() + 5 * 60 * 1000);

        // Cập nhật nguyên tử trạng thái ghế: Chỉ nhận ghế AVAILABLE hoặc HELD đã quá hạn 5 phút
        const updatedSeats = await tx
          .update(seats)
          .set({
            status: SeatStatus.HELD,
            holdExpiresAt,
            version: sql`${seats.version} + 1`,
            updatedAt: now,
          })
          .where(
            and(
              inArray(seats.id, sortedSeatIds),
              eq(seats.eventId, dto.eventId),
              or(
                eq(seats.status, SeatStatus.AVAILABLE),
                and(
                  eq(seats.status, SeatStatus.HELD),
                  lt(seats.holdExpiresAt, now),
                ),
              ),
            ),
          )
          .returning({ id: seats.id });

        if (updatedSeats.length < sortedSeatIds.length) {
          throw new ConflictException({
            success: false,
            error: {
              code: "SEAT_ALREADY_HELD",
              message:
                "Một hoặc nhiều ghế đã được người khác giữ chỗ hoặc đã bán",
              timestamp: new Date().toISOString(),
            },
          });
        }
      }

      // 2. Khóa và cập nhật khu đứng không số
      for (const item of standingItems) {
        const qty = item.quantity ?? 1;

        // Khóa dòng hạng vé
        const [lockedTT] = await tx
          .select({
            id: ticketTypes.id,
            capacity: ticketTypes.capacity,
            heldCount: ticketTypes.heldCount,
            soldCount: ticketTypes.soldCount,
            isSeated: ticketTypes.isSeated,
          })
          .from(ticketTypes)
          .where(
            and(
              eq(ticketTypes.id, item.ticketTypeId),
              eq(ticketTypes.eventId, dto.eventId),
            ),
          )
          .for("update");

        if (!lockedTT || lockedTT.isSeated) {
          throw new BadRequestException({
            success: false,
            error: {
              code: "INVALID_TICKET_TYPE",
              message: "Hạng vé khu đứng không hợp lệ",
              timestamp: new Date().toISOString(),
            },
          });
        }

        if (lockedTT.soldCount + lockedTT.heldCount + qty > lockedTT.capacity) {
          throw new ConflictException({
            success: false,
            error: {
              code: "INSUFFICIENT_TICKET_CAPACITY",
              message: "Số lượng vé khu đứng không còn đủ để giữ chỗ",
              timestamp: new Date().toISOString(),
            },
          });
        }

        await tx
          .update(ticketTypes)
          .set({
            heldCount: sql`${ticketTypes.heldCount} + ${qty}`,
            updatedAt: new Date(),
          })
          .where(eq(ticketTypes.id, item.ticketTypeId));
      }

      // 3. Tính toán tổng tiền
      const allTicketTypeIds = Array.from(
        new Set(dto.items.map((i) => i.ticketTypeId)),
      );
      const ticketTypeRows = await tx.query.ticketTypes.findMany({
        where: inArray(ticketTypes.id, allTicketTypeIds),
      });

      const ttMap = new Map(ticketTypeRows.map((tt) => [tt.id, tt]));

      let totalAmount = 0;
      const orderItemPayloads: Array<{
        ticketTypeId: string;
        seatId: string | null;
        quantity: number;
        unitPrice: string;
        subtotal: string;
      }> = [];

      for (const item of dto.items) {
        const tt = ttMap.get(item.ticketTypeId);
        if (!tt) {
          throw new NotFoundException({
            success: false,
            error: {
              code: "TICKET_TYPE_NOT_FOUND",
              message: `Hạng vé ${item.ticketTypeId} không tồn tại`,
              timestamp: new Date().toISOString(),
            },
          });
        }

        const price = Number(tt.price);
        const qty = item.quantity ?? 1;
        const subtotal = price * qty;
        totalAmount += subtotal;

        orderItemPayloads.push({
          ticketTypeId: item.ticketTypeId,
          seatId: item.seatId ?? null,
          quantity: qty,
          unitPrice: price.toFixed(2),
          subtotal: subtotal.toFixed(2),
        });
      }

      // 4. Tạo bản ghi đơn hàng PENDING có hạn 5 phút
      const now = new Date();
      const expiresAt = new Date(now.getTime() + 5 * 60 * 1000);
      const randomSuffix = crypto.randomBytes(3).toString("hex").toUpperCase();
      const orderCode = `ORD-${now.getFullYear()}${(now.getMonth() + 1).toString().padStart(2, "0")}${now.getDate().toString().padStart(2, "0")}-${randomSuffix}`;

      const [newOrder] = await tx
        .insert(orders)
        .values({
          orderCode,
          userId,
          eventId: dto.eventId,
          totalAmount: totalAmount.toFixed(2),
          discountAmount: "0.00",
          finalAmount: totalAmount.toFixed(2),
          status: OrderStatus.PENDING,
          expiresAt,
        })
        .returning();

      if (!newOrder) {
        throw new Error("Không thể tạo bản ghi đơn hàng");
      }

      // 5. Gắn orderId vào các ghế đã giữ
      if (sortedSeatIds.length > 0) {
        await tx
          .update(seats)
          .set({ holdOrderId: newOrder.id })
          .where(inArray(seats.id, sortedSeatIds));
      }

      // 6. Thêm các dòng chi tiết đơn hàng
      const itemsToInsert = orderItemPayloads.map((i) => ({
        orderId: newOrder.id,
        ticketTypeId: i.ticketTypeId,
        seatId: i.seatId,
        quantity: i.quantity,
        unitPrice: i.unitPrice,
        subtotal: i.subtotal,
      }));

      await tx.insert(orderItems).values(itemsToInsert);

      // 7. Ghi nhận sự kiện Outbox
      await tx.insert(outbox).values({
        eventType: "ORDER_HOLD_CREATED",
        payload: {
          orderId: newOrder.id,
          orderCode: newOrder.orderCode,
          userId,
          eventId: dto.eventId,
          heldSeats: sortedSeatIds,
          totalAmount,
          expiresAt: expiresAt.toISOString(),
        },
        status: OutboxStatus.PENDING,
      });

      return {
        orderId: newOrder.id,
        orderCode: newOrder.orderCode,
        heldSeats: sortedSeatIds,
        totalAmount,
        holdExpiresAt: expiresAt.toISOString(),
        remainingSeconds: 300,
      };
    });

    // Chi xoa cache sau khi PostgreSQL commit thanh cong
    await this.eventReadCacheService.invalidate(dto.eventId);

    return result;
  }

  async releaseHold(userId: string, orderId: string) {
    const order = await db.query.orders.findFirst({
      where: and(eq(orders.id, orderId), eq(orders.userId, userId)),
      with: { items: true },
    });

    if (!order) {
      throw new NotFoundException({
        success: false,
        error: {
          code: "ORDER_NOT_FOUND",
          message: "Không tìm thấy đơn hàng cần giải phóng",
          timestamp: new Date().toISOString(),
        },
      });
    }

    if (order.status !== OrderStatus.PENDING) {
      throw new BadRequestException({
        success: false,
        error: {
          code: "ORDER_NOT_PENDING",
          message: `Chỉ đơn hàng PENDING mới có thể hủy giữ chỗ (trạng thái: ${order.status})`,
          timestamp: new Date().toISOString(),
        },
      });
    }

    const result = await db.transaction(async (tx) => {
      // 1. Cập nhật đơn hàng thành CANCELLED
      const updatedOrders = await tx
        .update(orders)
        .set({
          status: OrderStatus.CANCELLED,
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(orders.id, orderId),
            eq(orders.userId, userId),
            eq(orders.status, OrderStatus.PENDING),
          ),
        )
        .returning({ id: orders.id });

      if (updatedOrders.length !== 1) {
        throw new ConflictException({
          success: false,
          error: {
            code: "ORDER_STATUS_CHANGED",
            message: "Trạng thái đơn hàng đã thay đổi, không thể hủy giữ chỗ",
            timestamp: new Date().toISOString(),
          },
        });
      }

      // 2. Trả ghế về AVAILABLE
      await tx
        .update(seats)
        .set({
          status: SeatStatus.AVAILABLE,
          holdOrderId: null,
          holdExpiresAt: null,
          version: sql`${seats.version} + 1`,
          updatedAt: new Date(),
        })
        .where(eq(seats.holdOrderId, orderId));

      // 3. Hoàn trả held_count cho khu đứng
      for (const item of order.items) {
        if (!item.seatId) {
          await tx
            .update(ticketTypes)
            .set({
              heldCount: sql`GREATEST(0, ${ticketTypes.heldCount} - ${item.quantity})`,
              updatedAt: new Date(),
            })
            .where(eq(ticketTypes.id, item.ticketTypeId));
        }
      }

      // 4. Ghi outbox
      await tx.insert(outbox).values({
        eventType: "ORDER_HOLD_RELEASED",
        payload: {
          orderId,
          userId,
          releasedAt: new Date().toISOString(),
        },
        status: OutboxStatus.PENDING,
      });

      return {
        message: "Đã giải phóng ghế thành công",
      };
    });

    // Sau khi huy giu ve thanh cong
    await this.eventReadCacheService.invalidate(order.eventId);

    return result;
  }

  async getOrderById(userId: string, orderId: string) {
    const order = await db.query.orders.findFirst({
      where: and(eq(orders.id, orderId), eq(orders.userId, userId)),
      with: {
        items: {
          with: {
            ticketType: true,
            seat: true,
          },
        },
        event: true,
      },
    });

    if (!order) {
      throw new NotFoundException({
        success: false,
        error: {
          code: "ORDER_NOT_FOUND",
          message: "Không tìm thấy đơn hàng",
          timestamp: new Date().toISOString(),
        },
      });
    }

    const now = Date.now();
    const remainingSeconds = Math.max(
      0,
      Math.floor((order.expiresAt.getTime() - now) / 1000),
    );

    return {
      ...order,
      remainingSeconds,
    };
  }

  // Tác vụ quét thu hồi đơn hàng và ghế hết hạn
  async cleanExpiredOrders(): Promise<{ expiredOrdersCount: number }> {
    const now = new Date();

    const result = await db.transaction(async (tx) => {
      // Tìm các đơn hàng PENDING đã hết hạn
      const expiredOrders = await tx
        .select({
          id: orders.id,
          eventId: orders.eventId,
        })
        .from(orders)
        .where(
          and(
            eq(orders.status, OrderStatus.PENDING),
            lt(orders.expiresAt, now),
          ),
        )
        .for("update");
      const expiredSeatEvents = await tx
        .selectDistinct({ eventId: seats.eventId })
        .from(seats)
        .where(
          and(eq(seats.status, SeatStatus.HELD), lt(seats.holdExpiresAt, now)),
        );

      const affectedEventIds = Array.from(
        new Set([
          ...expiredOrders.map((item) => item.eventId),
          ...expiredSeatEvents.map((item) => item.eventId),
        ]),
      );
      if (expiredOrders.length === 0) {
        // Vẫn dọn các ghế rác nếu có trạng thái HELD mà quá hạn
        await tx
          .update(seats)
          .set({
            status: SeatStatus.AVAILABLE,
            holdOrderId: null,
            holdExpiresAt: null,
            version: sql`${seats.version} + 1`,
            updatedAt: now,
          })
          .where(
            and(
              eq(seats.status, SeatStatus.HELD),
              lt(seats.holdExpiresAt, now),
            ),
          );
        return {
          expiredOrdersCount: 0,
          affectedEventIds,
        };
      }

      const expiredOrderIds = expiredOrders.map((o) => o.id);

      // Cập nhật đơn hàng thành EXPIRED
      await tx
        .update(orders)
        .set({ status: OrderStatus.EXPIRED, updatedAt: now })
        .where(inArray(orders.id, expiredOrderIds));

      // Giải phóng ghế thuộc các đơn hết hạn
      await tx
        .update(seats)
        .set({
          status: SeatStatus.AVAILABLE,
          holdOrderId: null,
          holdExpiresAt: null,
          version: sql`${seats.version} + 1`,
          updatedAt: now,
        })
        .where(
          or(
            inArray(seats.holdOrderId, expiredOrderIds),
            and(
              eq(seats.status, SeatStatus.HELD),
              lt(seats.holdExpiresAt, now),
            ),
          ),
        );

      // Hoàn trả held_count cho vé đứng thuộc các đơn hết hạn
      const standingOrderItems = await tx
        .select({
          ticketTypeId: orderItems.ticketTypeId,
          quantity: orderItems.quantity,
        })
        .from(orderItems)
        .where(
          and(
            inArray(orderItems.orderId, expiredOrderIds),
            sql`${orderItems.seatId} IS NULL`,
          ),
        );

      for (const item of standingOrderItems) {
        await tx
          .update(ticketTypes)
          .set({
            heldCount: sql`GREATEST(0, ${ticketTypes.heldCount} - ${item.quantity})`,
            updatedAt: now,
          })
          .where(eq(ticketTypes.id, item.ticketTypeId));
      }

      return {
        expiredOrdersCount: expiredOrderIds.length,
        affectedEventIds,
      };
    });
    await Promise.all(
      result.affectedEventIds.map((eventId) =>
        this.eventReadCacheService.invalidate(eventId),
      ),
    );

    return {
      expiredOrdersCount: result.expiredOrdersCount,
    };
  }
}
