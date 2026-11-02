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
  transactions,
  vouchers,
  voucherRedemptions,
} from "../database/schema";
import {
  HoldSeatsRequest,
  OrderStatus,
  OutboxStatus,
  EventStatus,
  SeatStatus,
  AllocatedSeatItem,
} from "@tickethub/shared";
import { WaitingRoomService } from "../waiting-room/waiting-room.service";
import { EventReadCacheService } from "../events/event-read-cache.service";

interface CandidateSeat {
  id: string;
  zoneName: string;
  rowLabel: string;
  seatNumber: string;
  ticketTypeId: string;
}

function parseSeatNumber(seatNum: string): number {
  const match = seatNum.match(/\d+/);
  return match ? parseInt(match[0], 10) : 0;
}

function findContiguousSeats(
  candidates: CandidateSeat[],
  quantity: number,
): CandidateSeat[] {
  if (candidates.length < quantity) {
    return [];
  }

  // Gom nhom theo rowLabel
  const byRow = new Map<string, CandidateSeat[]>();
  for (const seat of candidates) {
    if (!byRow.has(seat.rowLabel)) {
      byRow.set(seat.rowLabel, []);
    }
    byRow.get(seat.rowLabel)!.push(seat);
  }

  // Pass 1: Tim chuoi quantity ghe lien tiep trong cung 1 hang
  for (const [, rowSeats] of byRow.entries()) {
    const sorted = [...rowSeats].sort(
      (a, b) => parseSeatNumber(a.seatNumber) - parseSeatNumber(b.seatNumber),
    );
    if (sorted.length >= quantity) {
      for (let i = 0; i <= sorted.length - quantity; i++) {
        let isConsecutive = true;
        for (let j = 0; j < quantity - 1; j++) {
          if (
            parseSeatNumber(sorted[i + j + 1]!.seatNumber) !==
            parseSeatNumber(sorted[i + j]!.seatNumber) + 1
          ) {
            isConsecutive = false;
            break;
          }
        }
        if (isConsecutive) {
          return sorted.slice(i, i + quantity);
        }
      }
    }
  }

  // Pass 2: Fallback lay quantity ghe trong cung 1 hang du khong lien tiep
  for (const [, rowSeats] of byRow.entries()) {
    if (rowSeats.length >= quantity) {
      const sorted = [...rowSeats].sort(
        (a, b) => parseSeatNumber(a.seatNumber) - parseSeatNumber(b.seatNumber),
      );
      return sorted.slice(0, quantity);
    }
  }

  // Pass 3: Fallback lay cac ghe trong khac hang
  return candidates.slice(0, quantity);
}

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
    // Controller phải dùng HoldSeatsRequestSchema.safeParse() trước khi gọi service.
    const voucherCode = dto.voucherCode?.trim().toUpperCase();

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

    if (dto.items.length === 0) {
      throw new BadRequestException("Đơn hàng phải có ít nhất một hạng vé");
    }
    // Tải thông tin các hạng vé trước
    const allTicketTypeIds = Array.from(
      new Set(dto.items.map((i) => i.ticketTypeId)),
    );

    const ticketTypeRows = await db.query.ticketTypes.findMany({
      where: and(
        inArray(ticketTypes.id, allTicketTypeIds),
        eq(ticketTypes.eventId, dto.eventId),
      ),
    });

    const ttMap = new Map(ticketTypeRows.map((tt) => [tt.id, tt]));

    for (const item of dto.items) {
      if (!ttMap.has(item.ticketTypeId)) {
        throw new NotFoundException({
          success: false,
          error: {
            code: "TICKET_TYPE_NOT_FOUND",
            message: `Hạng vé ${item.ticketTypeId} không tồn tại trong sự kiện`,
            timestamp: new Date().toISOString(),
          },
        });
      }
    }

    // Bảo vệ giá từ DB, thời gian mở bán và hạn mức riêng từng hạng vé.
    // Gom quantity theo ticketTypeId để tránh vượt maxPerOrder bằng nhiều items.
    const quantityByTicketType = new Map<string, number>();
    for (const item of dto.items) {
      const quantity = item.quantity ?? 1;
      quantityByTicketType.set(
        item.ticketTypeId,
        (quantityByTicketType.get(item.ticketTypeId) ?? 0) + quantity,
      );
    }

    const checkTime = new Date();
    for (const tt of ticketTypeRows) {
      const price = Number(tt.price);
      if (!Number.isSafeInteger(price) || price < 0) {
        throw new BadRequestException("Giá vé phải là số nguyên VND hợp lệ");
      }

      if (checkTime < tt.saleStartTime || checkTime > tt.saleEndTime) {
        throw new BadRequestException(
          `Hạng vé ${tt.name} chưa mở bán hoặc đã kết thúc bán`,
        );
      }

      if ((quantityByTicketType.get(tt.id) ?? 0) > tt.maxPerOrder) {
        throw new BadRequestException(
          `Hạng vé ${tt.name} vượt quá giới hạn ${tt.maxPerOrder} vé mỗi đơn`,
        );
      }
    }

    // Phân loại: tự động phân bổ ghế (chuẩn domain model), ghế chỉ định (tương thích ngược), và vé đứng
    const explicitSeatedItems = dto.items.filter((i) => Boolean(i.seatId));
    const autoSeatedItems = dto.items.filter(
      (i) => !i.seatId && ttMap.get(i.ticketTypeId)?.isSeated === true,
    );
    const standingItems = dto.items.filter(
      (i) => !i.seatId && ttMap.get(i.ticketTypeId)?.isSeated === false,
    );

    const explicitSeatIds = explicitSeatedItems.map((i) => i.seatId!);
    if (new Set(explicitSeatIds).size !== explicitSeatIds.length) {
      throw new BadRequestException({
        success: false,
        error: {
          code: "DUPLICATE_SEATS",
          message: "Danh sách ghế yêu cầu chứa vị trí trùng lặp",
          timestamp: new Date().toISOString(),
        },
      });
    }

    const sortedExplicitSeatIds = [...explicitSeatIds].sort();

    const result = await db.transaction(async (tx) => {
      const now = new Date();
      const holdExpiresAt = new Date(now.getTime() + 5 * 60 * 1000);
      const allHeldSeatIds: string[] = [];
      const allHeldSeatIdsSet = new Set<string>();
      const allocatedSeatItems: AllocatedSeatItem[] = [];
      const orderItemPayloads: Array<{
        ticketTypeId: string;
        seatId: string | null;
        quantity: number;
        unitPrice: string;
        subtotal: string;
      }> = [];
      let totalAmount = 0;

      // 1. Khóa và cập nhật ghế ngồi chỉ định cụ thể (hỗ trợ tương thích ngược cho test suites)
      if (sortedExplicitSeatIds.length > 0) {
        const lockedSeats = await tx
          .select({
            id: seats.id,
            status: seats.status,
            ticketTypeId: seats.ticketTypeId,
            zoneName: seats.zoneName,
            rowLabel: seats.rowLabel,
            seatNumber: seats.seatNumber,
          })
          .from(seats)
          .where(
            and(
              inArray(seats.id, sortedExplicitSeatIds),
              eq(seats.eventId, dto.eventId),
            ),
          )
          .orderBy(asc(seats.id))
          .for("update");

        if (lockedSeats.length < sortedExplicitSeatIds.length) {
          throw new NotFoundException({
            success: false,
            error: {
              code: "SEAT_NOT_FOUND",
              message: "Một số ghế yêu cầu không tồn tại trong sự kiện",
              timestamp: new Date().toISOString(),
            },
          });
        }

        const seatTypeById = new Map(
          lockedSeats.map((seat) => [seat.id, seat.ticketTypeId]),
        );

        for (const item of explicitSeatedItems) {
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
              inArray(seats.id, sortedExplicitSeatIds),
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

        if (updatedSeats.length < sortedExplicitSeatIds.length) {
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

        for (const s of lockedSeats) {
          allHeldSeatIds.push(s.id);
          allHeldSeatIdsSet.add(s.id);
          allocatedSeatItems.push({
            id: s.id,
            zoneName: s.zoneName,
            rowLabel: s.rowLabel,
            seatNumber: s.seatNumber,
          });

          const tt = ttMap.get(s.ticketTypeId)!;
          const price = Number(tt.price);
          totalAmount += price;
          orderItemPayloads.push({
            ticketTypeId: s.ticketTypeId,
            seatId: s.id,
            quantity: 1,
            unitPrice: price.toFixed(2),
            subtotal: price.toFixed(2),
          });
        }
      }

      // 2. Tự động phân bổ ghế ngồi liền kề cho vé ngồi không chỉ định seatId
      for (const autoItem of autoSeatedItems) {
        const qty = autoItem.quantity ?? 1;
        let chosenAutoSeats: CandidateSeat[] = [];
        let allocated = false;
        const maxRetries = 10;

        for (let attempt = 0; attempt < maxRetries; attempt++) {
          const candidateSeats = await tx
            .select({
              id: seats.id,
              zoneName: seats.zoneName,
              rowLabel: seats.rowLabel,
              seatNumber: seats.seatNumber,
              ticketTypeId: seats.ticketTypeId,
            })
            .from(seats)
            .where(
              and(
                eq(seats.eventId, dto.eventId),
                eq(seats.ticketTypeId, autoItem.ticketTypeId),
                or(
                  eq(seats.status, SeatStatus.AVAILABLE),
                  and(
                    eq(seats.status, SeatStatus.HELD),
                    lt(seats.holdExpiresAt, now),
                  ),
                ),
              ),
            )
            .orderBy(asc(seats.rowLabel), asc(seats.seatNumber));

          const availableCandidates = candidateSeats.filter(
            (s) => !allHeldSeatIdsSet.has(s.id),
          );

          const chosen = findContiguousSeats(availableCandidates, qty);
          if (chosen.length < qty) {
            throw new ConflictException({
              success: false,
              error: {
                code: "INSUFFICIENT_TICKET_CAPACITY",
                message:
                  "Số lượng ghế trống không còn đủ để giữ chỗ theo yêu cầu",
                timestamp: new Date().toISOString(),
              },
            });
          }

          const chosenSeatIds = chosen.map((s) => s.id).sort();

          // Khóa các ghế được chọn bằng SELECT ... FOR UPDATE theo thứ tự id tăng dần
          const lockedAutoSeats = await tx
            .select({
              id: seats.id,
              zoneName: seats.zoneName,
              rowLabel: seats.rowLabel,
              seatNumber: seats.seatNumber,
              ticketTypeId: seats.ticketTypeId,
            })
            .from(seats)
            .where(
              and(
                inArray(seats.id, chosenSeatIds),
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
            .orderBy(asc(seats.id))
            .for("update");

          if (lockedAutoSeats.length === chosenSeatIds.length) {
            chosenAutoSeats = lockedAutoSeats;
            allocated = true;
            break;
          }
          // Neu bi transaction khac chiem mat, thu tim tiep o vong lap sau
        }

        if (!allocated || chosenAutoSeats.length < qty) {
          throw new ConflictException({
            success: false,
            error: {
              code: "SEAT_ALREADY_HELD",
              message:
                "Một số ghế phân bổ vừa được người khác giữ chỗ. Vui lòng thử lại.",
              timestamp: new Date().toISOString(),
            },
          });
        }

        const chosenSeatIds = chosenAutoSeats.map((s) => s.id).sort();

        await tx
          .update(seats)
          .set({
            status: SeatStatus.HELD,
            holdExpiresAt,
            version: sql`${seats.version} + 1`,
            updatedAt: now,
          })
          .where(inArray(seats.id, chosenSeatIds));

        const tt = ttMap.get(autoItem.ticketTypeId)!;
        const price = Number(tt.price);

        for (const s of chosenAutoSeats) {
          allHeldSeatIds.push(s.id);
          allHeldSeatIdsSet.add(s.id);
          allocatedSeatItems.push({
            id: s.id,
            zoneName: s.zoneName,
            rowLabel: s.rowLabel,
            seatNumber: s.seatNumber,
          });

          totalAmount += price;
          orderItemPayloads.push({
            ticketTypeId: s.ticketTypeId,
            seatId: s.id,
            quantity: 1,
            unitPrice: price.toFixed(2),
            subtotal: price.toFixed(2),
          });
        }
      }

      // 3. Khóa và cập nhật khu đứng không số
      for (const item of standingItems) {
        const qty = item.quantity ?? 1;

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
            updatedAt: now,
          })
          .where(eq(ticketTypes.id, item.ticketTypeId));

        const tt = ttMap.get(item.ticketTypeId)!;
        const price = Number(tt.price);
        const subtotal = price * qty;
        totalAmount += subtotal;

        orderItemPayloads.push({
          ticketTypeId: item.ticketTypeId,
          seatId: null,
          quantity: qty,
          unitPrice: price.toFixed(2),
          subtotal: subtotal.toFixed(2),
        });
      }

      // Kiểm tra lại các hạng vé NGAY TRƯỚC KHI TẠO ĐƠN (trong transaction):
      // nếu organizer đổi giá/thời gian bán khi đang chọn ghế, rollback toàn bộ.
      const confirmedTypes = await tx
        .select({
          id: ticketTypes.id,
          name: ticketTypes.name,
          price: ticketTypes.price,
          saleStartTime: ticketTypes.saleStartTime,
          saleEndTime: ticketTypes.saleEndTime,
          maxPerOrder: ticketTypes.maxPerOrder,
        })
        .from(ticketTypes)
        .where(
          and(
            inArray(ticketTypes.id, allTicketTypeIds),
            eq(ticketTypes.eventId, dto.eventId),
          ),
        )
        .orderBy(asc(ticketTypes.id))
        .for("update");

      if (confirmedTypes.length !== allTicketTypeIds.length) {
        throw new ConflictException("Hạng vé vừa thay đổi; vui lòng đặt lại");
      }

      const verifyTime = new Date();
      for (const current of confirmedTypes) {
        const original = ttMap.get(current.id);
        if (!original || original.price !== current.price) {
          throw new ConflictException("Giá vé vừa thay đổi; vui lòng đặt lại");
        }
        if (
          verifyTime < current.saleStartTime ||
          verifyTime > current.saleEndTime ||
          (quantityByTicketType.get(current.id) ?? 0) > current.maxPerOrder
        ) {
          throw new ConflictException(
            `Hạng vé ${current.name} không còn đủ điều kiện mở bán`,
          );
        }
      }

      if (!Number.isSafeInteger(totalAmount) || totalAmount < 0) {
        throw new BadRequestException("Tổng tiền vé không hợp lệ");
      }
      const subtotalVnd = BigInt(totalAmount);
      let discountVnd = 0n;
      let voucherId: string | undefined;

      if (voucherCode) {
        const [voucher] = await tx
          .select()
          .from(vouchers)
          .where(
            and(
              eq(vouchers.code, voucherCode),
              eq(vouchers.eventId, dto.eventId),
            ),
          )
          .for("update");

        if (
          !voucher ||
          !voucher.isActive ||
          now < voucher.startsAt ||
          now > voucher.endsAt
        ) {
          throw new BadRequestException("Voucher không hợp lệ hoặc đã hết hạn");
        }

        const [usage] = await tx
          .select({
            count: sql<number>`count(*)::int`,
          })
          .from(voucherRedemptions)
          .where(
            and(
              eq(voucherRedemptions.voucherId, voucher.id),
              inArray(voucherRedemptions.status, ["RESERVED", "REDEEMED"]),
            ),
          );

        if (
          voucher.maxUses !== null &&
          (usage?.count ?? 0) >= voucher.maxUses
        ) {
          throw new ConflictException("Voucher đã hết lượt sử dụng");
        }

        // Các giá trị numeric được quản lý theo VND,
        // không cho phép phần lẻ khác 0.
        const toVnd = (value: string): bigint => {
          if (!/^\d+(?:\.0{1,2})?$/.test(value)) {
            throw new BadRequestException("Cấu hình tiền voucher không hợp lệ");
          }
          return BigInt(value.split(".")[0]!);
        };

        if (subtotalVnd < toVnd(voucher.minOrderAmount)) {
          throw new BadRequestException("Đơn hàng chưa đạt giá trị tối thiểu");
        }

        const value = toVnd(voucher.discountValue);

        if (voucher.discountType === "PERCENT") {
          if (value <= 0n || value > 100n) {
            throw new BadRequestException("Phần trăm giảm giá không hợp lệ");
          }

          discountVnd = (subtotalVnd * value) / 100n;
        } else {
          discountVnd = value > subtotalVnd ? subtotalVnd : value;
        }

        voucherId = voucher.id;
      }

      // VNPay không xử lý giao dịch có số tiền bằng 0.
      const finalVnd = subtotalVnd - discountVnd;

      if (finalVnd <= 0n || finalVnd > 9_999_999_999n) {
        throw new BadRequestException(
          "Số tiền thanh toán không hợp lệ cho VNPay",
        );
      }

      // 4. Tạo bản ghi đơn hàng PENDING có hạn 5 phút
      const randomSuffix = crypto.randomBytes(3).toString("hex").toUpperCase();
      const orderCode = `ORD-${now.getFullYear()}${(now.getMonth() + 1).toString().padStart(2, "0")}${now.getDate().toString().padStart(2, "0")}-${randomSuffix}`;

      const [newOrder] = await tx
        .insert(orders)
        .values({
          orderCode,
          userId,
          eventId: dto.eventId,
          totalAmount: `${subtotalVnd}.00`,
          discountAmount: `${discountVnd}.00`,
          finalAmount: `${finalVnd}.00`,
          voucherCode: voucherCode ?? null,
          status: OrderStatus.PENDING,
          expiresAt: holdExpiresAt,
        })
        .returning();

      if (!newOrder) {
        throw new Error("Không thể tạo bản ghi đơn hàng");
      }

      // Lượt sử dụng giữ trong cùng transaction với đơn và ghế.
      if (voucherId) {
        await tx.insert(voucherRedemptions).values({
          voucherId,
          orderId: newOrder.id,
          status: "RESERVED",
        });
      }

      // 5. Gắn orderId vào các ghế đã giữ
      if (allHeldSeatIds.length > 0) {
        await tx
          .update(seats)
          .set({ holdOrderId: newOrder.id })
          .where(inArray(seats.id, allHeldSeatIds));
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
      allocatedSeatItems.sort((a, b) => {
        if (a.rowLabel !== b.rowLabel) {
          return a.rowLabel.localeCompare(b.rowLabel);
        }
        return parseSeatNumber(a.seatNumber) - parseSeatNumber(b.seatNumber);
      });

      await tx.insert(outbox).values({
        eventType: "ORDER_HOLD_CREATED",
        payload: {
          orderId: newOrder.id,
          orderCode: newOrder.orderCode,
          userId,
          eventId: dto.eventId,
          heldSeats: allHeldSeatIds,
          allocatedSeats: allocatedSeatItems,
          totalAmount: totalAmount.toFixed(2),
          discountAmount: `${discountVnd}.00`,
          finalAmount: `${finalVnd}.00`,
          voucherCode: voucherCode ?? null,
          expiresAt: holdExpiresAt.toISOString(),
        },
        status: OutboxStatus.PENDING,
      });

      return {
        orderId: newOrder.id,
        orderCode: newOrder.orderCode,
        heldSeats: allHeldSeatIds,
        allocatedSeats: allocatedSeatItems,
        totalAmount,
        discountAmount: Number(discountVnd),
        finalAmount: Number(finalVnd),
        holdExpiresAt: holdExpiresAt.toISOString(),
        remainingSeconds: 300,
        voucherCode: voucherCode ?? null,
      };
    });

    // Chi xoa cache sau khi PostgreSQL commit thanh cong
    await this.eventReadCacheService.invalidate(dto.eventId);

    return result;
  }

  async releaseHold(userId: string, orderId: string) {
    // Cùng thứ tự khóa với PaymentService và PaymentSettlementService:
    // khóa orders trước khi kiểm tra transactions và cập nhật tồn kho.
    const result = await db.transaction(async (tx) => {
      const [order] = await tx
        .select()
        .from(orders)
        .where(and(eq(orders.id, orderId), eq(orders.userId, userId)))
        .limit(1)
        .for("update");

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

      // Chỉ cho hủy trực tiếp khi CHƯA khởi tạo thanh toán.
      // Kể cả giao dịch FAILED vẫn phải xem xét/đối soát theo luồng thanh toán;
      // không hủy/vứt lượt voucher từ đây nếu đã có transaction.
      const [paymentAttempt] = await tx
        .select({ id: transactions.id })
        .from(transactions)
        .where(eq(transactions.orderId, orderId))
        .limit(1);

      if (paymentAttempt) {
        throw new ConflictException(
          "Đơn hàng đã khởi tạo thanh toán VNPay, vui lòng chờ xác nhận hoặc đối soát trước khi hủy",
        );
      }

      const items = await tx
        .select({
          seatId: orderItems.seatId,
          ticketTypeId: orderItems.ticketTypeId,
          quantity: orderItems.quantity,
        })
        .from(orderItems)
        .where(eq(orderItems.orderId, orderId));

      const now = new Date();
      const updated = await tx
        .update(orders)
        .set({ status: OrderStatus.CANCELLED, updatedAt: now })
        .where(
          and(eq(orders.id, orderId), eq(orders.status, OrderStatus.PENDING)),
        )
        .returning({ id: orders.id });

      if (updated.length !== 1) {
        throw new ConflictException("Trạng thái đơn hàng đã thay đổi");
      }

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
            eq(seats.holdOrderId, orderId),
            eq(seats.status, SeatStatus.HELD),
          ),
        );

      // Hoàn trả held_count của khu vé đứng theo đúng số vé đã giữ.
      for (const item of items) {
        if (item.seatId === null) {
          await tx
            .update(ticketTypes)
            .set({
              heldCount: sql`GREATEST(0, ${ticketTypes.heldCount} - ${item.quantity})`,
              updatedAt: now,
            })
            .where(eq(ticketTypes.id, item.ticketTypeId));
        }
      }

      // Không cho voucher RESERVED tiếp tục chiếm lượt khi hủy trước thanh toán.
      await tx
        .update(voucherRedemptions)
        .set({ status: "RELEASED" })
        .where(
          and(
            eq(voucherRedemptions.orderId, orderId),
            eq(voucherRedemptions.status, "RESERVED"),
          ),
        );

      await tx.insert(outbox).values({
        eventType: "ORDER_HOLD_RELEASED",
        payload: {
          orderId,
          userId,
          releasedAt: now.toISOString(),
        },
        status: OutboxStatus.PENDING,
      });

      return {
        eventId: order.eventId,
        message: "Đã giải phóng ghế thành công",
      };
    });

    await this.eventReadCacheService.invalidate(result.eventId);
    return { message: result.message };
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
        // Chỉ dọn ghế HELD bị mồ côi; ghế có holdOrderId hợp lệ
        // phải xử lý theo vòng đời đơn/đối soát thanh toán.
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
              sql`${seats.holdOrderId} IS NULL`,
            ),
          );
        return {
          expiredOrdersCount: 0,
          affectedEventIds,
        };
      }

      const expiredOrderIds = expiredOrders.map((o) => o.id);

      // Đơn có giao dịch VNPay phải giữ lượt voucher để đợi IPN/QueryDR
      // (kể cả trường hợp trả tiền muộn rồi cần refund).
      const paymentOrders = await tx
        .selectDistinct({ orderId: transactions.orderId })
        .from(transactions)
        .where(inArray(transactions.orderId, expiredOrderIds));
      const hasPayment = new Set(paymentOrders.map((t) => t.orderId));
      const canReleaseVoucherOrderIds = expiredOrderIds.filter(
        (id) => !hasPayment.has(id),
      );

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
          and(
            eq(seats.status, SeatStatus.HELD),
            or(
              inArray(seats.holdOrderId, expiredOrderIds),
              and(
                lt(seats.holdExpiresAt, now),
                sql`${seats.holdOrderId} IS NULL`,
              ),
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

      // Chỉ giải phóng lượt voucher khi chưa từng khởi tạo thanh toán.
      // Settlement của VNPay chịu trách nhiệm REDEEMED/RELEASED sau đối soát.
      if (canReleaseVoucherOrderIds.length > 0) {
        await tx
          .update(voucherRedemptions)
          .set({ status: "RELEASED" })
          .where(
            and(
              inArray(voucherRedemptions.orderId, canReleaseVoucherOrderIds),
              eq(voucherRedemptions.status, "RESERVED"),
            ),
          );
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
