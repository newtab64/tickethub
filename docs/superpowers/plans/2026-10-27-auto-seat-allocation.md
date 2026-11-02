# Kế hoạch thực thi Tự động phân bổ ghế ngồi (Auto Seat Allocation)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Xây dựng cơ chế tự động phân bổ ghế tốt nhất liền kề (Best-Available / Contiguous Seat Allocation) trên Backend (`apps/api`), cho phép người mua giữ chỗ vé ngồi theo Khu vực / Hạng vé và Số lượng (1 đến 6 vé) mà không cần chọn tọa độ từng chấm ghế lẻ, đồng thời tích hợp luồng giữ chỗ thực tế giữa Frontend và Backend.

**Architecture:**

1. Cập nhật Schema chung tại `packages/shared/src/schemas/order.schema.ts`: hỗ trợ gửi yêu cầu giữ chỗ theo `{ ticketTypeId, quantity }` không bắt buộc `seatId` cho cả vé ngồi lẫn vé đứng, đồng thời chuẩn hóa kiểu dữ liệu phản hồi thông tin ghế đã cấp (`allocatedSeats: { id, zoneName, rowLabel, seatNumber }[]`).
2. Nâng cấp `BookingService.holdSeats` trong `apps/api/src/booking/booking.service.ts`:
   - Phân loại 3 luồng giữ chỗ: vé có ghế chỉ định sẵn (`explicitSeatedItems`), vé có ghế cần tự động phân bổ (`autoSeatedItems`), và vé đứng tự do (`standingItems`).
   - Cài đặt thuật toán tìm kiếm ghế liền kề (Contiguous Seat Algorithm) trong cùng một hàng (`rowLabel`) có khóa hàng `SELECT ... FOR UPDATE` theo thứ tự ID tăng dần để ngăn chặn triệt để xung đột đồng thời và deadlock.
   - Cơ chế dự phòng (Fallback): nếu không tìm thấy chuỗi ghế liền nhau trong cùng một hàng, hệ thống tự động gom các ghế trống gần nhau nhất trong cùng khu vực.
3. Bổ sung bộ kiểm thử tích hợp chuyên biệt `apps/api/test/auto-seat-allocation.integration.test.ts`: bao phủ các ca kiểm thử ghế liền kề, ca kiểm thử khi hết ghế, và ca kiểm thử tranh chấp đồng thời (concurrency với 10 yêu cầu song song).
4. Đồng bộ giải phóng ghế và tác vụ dọn dẹp đơn hết hạn (`cleanExpiredOrders` và `releaseHold`), đảm bảo các ghế tự động phân bổ được hoàn trả nguyên vẹn về trạng thái `AVAILABLE`.
5. Kết nối luồng `handleStartHold` trên Frontend [apps/web/src/app/(event)/events/[id]/page.tsx](<file:///home/user/Downloads/Repos/ticket-hub/apps/web/src/app/(event)/events/[id]/page.tsx>) với API Backend thực tế.

**Tech Stack:** NestJS, Fastify, PostgreSQL 16, Drizzle ORM (`FOR UPDATE`, transaction), Redis, Zod, TypeScript strict, Node.js test runner (`tsx --test`), Next.js 16.

**Spec:** Yêu cầu nghiệp vụ TicketHub (người dùng chọn khu vực và số lượng trên bản đồ kiến trúc SVG, không chọn từng ghế lẻ) và quy chuẩn kỹ thuật tại [docs/DEVELOPMENT_STANDARDS.md](file:///home/user/Downloads/Repos/ticket-hub/docs/DEVELOPMENT_STANDARDS.md), [CONTRIBUTING.md](file:///home/user/Downloads/Repos/ticket-hub/CONTRIBUTING.md).

---

## Global Constraints

- Không sử dụng biểu tượng cảm xúc (emoji) trong mã nguồn, commit message và tài liệu.
- Không sử dụng ký tự gạch ngang dài (em-dash), dùng dấu gạch nối (-), dấu hai chấm (:) hoặc ngoặc đơn thay thế.
- Toàn bộ Schema Zod và kiểu dùng chung bắt buộc đặt trong `packages/shared`.
- Mọi logic khóa ghế và trừ tồn kho phải thực thi trong database transaction của PostgreSQL với cơ chế khóa hàng `SELECT ... FOR UPDATE` (sắp xếp `id ASC`).
- Không phá vỡ các bài kiểm thử hiện có của `w03-be1.test.ts` (đảm bảo tính tương thích ngược).

---

## Review Focus

1. Phân bổ ghế liền kề chính xác: Đảm bảo khi khách đặt 2 hoặc 3 vé ngồi, hệ thống tự động cấp các ghế có số liên tiếp trong cùng một hàng (ví dụ: Hàng A ghế 01, 02).
2. Kiểm soát tranh chấp đồng thời (Concurrency): Khi nhiều người cùng yêu cầu phân bổ ghế tự động cùng lúc trên một khu vực, không bao giờ được phép xảy ra hiện tượng cấp trùng ghế (Double Booking) hoặc deadlock.
3. Trường hợp biên hết ghế trong hàng: Khi một hàng chỉ còn 1 ghế trống mà người dùng mua 2 vé, thuật toán phải tự động chuyển sang hàng tiếp theo có đủ 2 ghế liền kề.
4. Trường hợp không đủ ghế: Khi số ghế trống còn lại trong toàn bộ hạng vé ít hơn số lượng yêu cầu, hệ thống phải ném lỗi `INSUFFICIENT_TICKET_CAPACITY` và không khóa giữ bất kỳ ghế nào.
5. Giải phóng ghế nguyên tử: Khi đơn hàng bị hủy hoặc hết hạn 5 phút, các ghế được tự động phân bổ phải lập tức quay về `AVAILABLE` và xóa liên kết `holdOrderId`.

---

## Danh sách Task chi tiết

### Task 1: Cập nhật Shared Schemas & DTO cho Auto Seat Allocation

**Files:**

- Modify: `packages/shared/src/schemas/order.schema.ts`
- Modify: `packages/shared/src/schemas/ticket.schema.ts`
- Test: `packages/shared/test` hoặc chạy kiểm tra kiểu dữ liệu `pnpm --filter @tickethub/shared build`

**Interfaces:**

- Consumes: Zod schema hiện tại của `HoldSeatsRequestSchema`.
- Produces: `AllocatedSeatItemSchema`, `HoldSeatsResponseSchema`, cập nhật `HoldSeatsRequestSchema` cho phép `quantity >= 1` khi `seatId` vắng mặt trên vé ngồi.

- [ ] **Step 1: Viết định nghĩa kiểu dữ liệu và schema Zod trong packages/shared**
      Cập nhật `packages/shared/src/schemas/order.schema.ts` bổ sung:

  ```typescript
  export const AllocatedSeatItemSchema = z.object({
    id: z.string().uuid(),
    zoneName: z.string(),
    rowLabel: z.string(),
    seatNumber: z.string(),
  });
  export type AllocatedSeatItem = z.infer<typeof AllocatedSeatItemSchema>;

  export const HoldSeatsResponseDataSchema = z.object({
    orderId: z.string().uuid(),
    orderCode: z.string(),
    heldSeats: z.array(z.string().uuid()),
    allocatedSeats: z.array(AllocatedSeatItemSchema).default([]),
    totalAmount: z.number(),
    holdExpiresAt: z.string(),
    remainingSeconds: z.number(),
  });
  export type HoldSeatsResponseData = z.infer<
    typeof HoldSeatsResponseDataSchema
  >;
  ```

- [ ] **Step 2: Biên dịch và xác thực gói shared**
      Run: `pnpm --filter @tickethub/shared build`
      Expected: PASS, file `.d.ts` sinh ra đầy đủ.

- [ ] **Step 3: Commit thay đổi Task 1**
  ```bash
  git add packages/shared/
  git commit -m "feat(shared): add allocated seat schemas for auto seat assignment"
  ```

---

### Task 2: Thuật toán Tự động gán ghế liền kề trong BookingService

**Files:**

- Modify: `apps/api/src/booking/booking.service.ts`
- Test: `apps/api/test/w03-be1.test.ts`

**Interfaces:**

- Consumes: `HoldSeatsRequest`, Drizzle tables (`seats`, `ticketTypes`, `orders`, `orderItems`).
- Produces: Logic tự động gán ghế liền kề trong `holdSeats()`.

- [ ] **Step 1: Viết hàm phụ trợ thuật toán tìm ghế liền kề trong booking.service.ts**
      Hàm nội bộ `findContiguousSeats(availableSeats: SeatRecord[], quantity: number): SeatRecord[]`:
  - Gom nhóm các ghế trống theo `rowLabel`.
  - Với mỗi hàng, sắp xếp các ghế theo thứ tự số tăng dần (chuyển đổi `parseInt(seatNumber, 10)`).
  - Tìm chuỗi `quantity` ghế có số liên tiếp (`seatNumber[i+1] === seatNumber[i] + 1`).
  - Nếu tìm thấy trong hàng nào, trả về ngay danh sách các ghế đó.
  - Nếu không có hàng nào đủ chuỗi liên tiếp, fallback chọn `quantity` ghế trống có khoảng cách số gần nhau nhất.
  - Nếu toàn bộ các hàng cộng lại không đủ `quantity`, ném ngoại lệ `ConflictException({ code: 'INSUFFICIENT_TICKET_CAPACITY' })`.

- [ ] **Step 2: Nâng cấp luồng holdSeats() trong booking.service.ts**
  - Tách `dto.items`:
    - `explicitSeatedItems`: có `seatId`.
    - `autoSeatedItems`: không có `seatId` nhưng `ticketType.isSeated === true`.
    - `standingItems`: không có `seatId` và `ticketType.isSeated === false`.
  - Trong transaction PostgreSQL:
    - Với mỗi `autoSeatedItem`:
      Truy vấn danh sách ghế có trạng thái `AVAILABLE` (hoặc `HELD` quá hạn) thuộc `ticketTypeId` và `eventId`.
      Thực thi `findContiguousSeats`.
      Khóa các ghế được chọn bằng `SELECT id FROM seats WHERE id IN (...) FOR UPDATE` (sắp xếp `id ASC`).
      Cập nhật `status = SeatStatus.HELD`, `holdOrderId = newOrder.id`, `holdExpiresAt = expiresAt`.
    - Đưa các ghế tự động phân bổ vào `orderItems` và danh sách trả về `allocatedSeats`.

- [ ] **Step 3: Chạy bộ kiểm thử hiện tại w03-be1.test.ts để đảm bảo không bị hồi quy (regression)**
      Run: `pnpm --filter @tickethub/api test:unit test/w03-be1.test.ts`
      Expected: Tất cả các ca kiểm thử hiện tại vẫn PASS 100%.

- [ ] **Step 4: Commit thay đổi Task 2**
  ```bash
  git add apps/api/src/booking/booking.service.ts
  git commit -m "feat(api): implement contiguous seat auto allocation algorithm"
  ```

---

### Task 3: Bổ sung bộ kiểm thử tích hợp chuyên biệt cho Auto Seat Allocation

**Files:**

- Create: `apps/api/test/auto-seat-allocation.integration.test.ts`
- Modify: `apps/api/package.json` (nếu cần bổ sung script test)

**Interfaces:**

- Consumes: `BookingService`, `db`, PostgreSQL thật, Redis thật.
- Produces: Test suite kiểm chứng toàn diện cho UC04 Auto Seat Allocation.

- [ ] **Step 1: Viết test suite auto-seat-allocation.integration.test.ts**
      Các ca kiểm thử bắt buộc:
  1. `Auto-allocation 2 ghế liền kề`: Tạo hàng ghế A (01, 02, 03, 04), yêu cầu giữ 2 vé không gửi `seatId` -> Hệ thống cấp chính xác ghế A01 và A02.
  2. `Tự động nhảy hàng khi hàng đầu bị phân mảnh`: Ghế A01 đã HELD, A02 AVAILABLE, A03 HELD; Hàng B có B01, B02 AVAILABLE. Yêu cầu 2 ghế -> Hệ thống tự động chọn B01 và B02 liền kề.
  3. `Từ chối khi không đủ sức chứa`: Khu vực chỉ còn 1 ghế trống nhưng khách đặt 2 vé -> Ném lỗi `INSUFFICIENT_TICKET_CAPACITY`.
  4. `Kiểm tra tranh chấp đồng thời (Concurrency)`: 5 người dùng đồng thời gửi yêu cầu tự động giữ 2 vé trên khu vực có đúng 10 ghế -> Toàn bộ 5 yêu cầu đều thành công, 10 ghế được phân bổ không có bất kỳ ghế nào trùng lặp.
  5. `Thu hồi ghế tự động khi hết hạn`: Đơn tự động gán ghế hết hạn 5 phút -> Tác vụ quét `cleanExpiredOrders` trả lại toàn bộ ghế về `AVAILABLE`.

- [ ] **Step 2: Thực thi kiểm thử tích hợp**
      Run: `pnpm --filter @tickethub/api test:unit test/auto-seat-allocation.integration.test.ts`
      Expected: 5/5 tests PASS.

- [ ] **Step 3: Commit thay đổi Task 3**
  ```bash
  git add apps/api/test/auto-seat-allocation.integration.test.ts
  git commit -m "test(api): add integration test suite for auto seat allocation"
  ```

---

### Task 4: Kết nối luồng Frontend Event Detail với API giữ chỗ tự động

**Files:**

- Modify: `apps/web/src/app/(event)/events/[id]/page.tsx`
- Test: `pnpm --filter @tickethub/web build` và `pnpm test:e2e`

**Interfaces:**

- Consumes: API `POST /api/v1/booking/hold`, `useSession`.
- Produces: Tích hợp giữ chỗ thực tế khi bấm vào danh sách gói vé ở khung bên phải.

- [ ] **Step 1: Cập nhật hàm handleStartHold trong page.tsx**
  - Khi người dùng bấm vào một gói vé (TicketListing) ở khung bên phải:
    - Nếu chưa đăng nhập: chuyển hướng sang trang đăng nhập hoặc mở modal yêu cầu đăng nhập.
    - Nếu đã đăng nhập: gọi API `POST /api/v1/booking/hold` với `{ eventId: event.id, items: [{ ticketTypeId: listing.id, quantity: ticketQuantity }] }`.
    - Nhận dữ liệu phản hồi: hiển thị đồng hồ đếm ngược 5 phút, lưu `orderId`, hiển thị thông tin ghế đã được hệ thống phân bổ (ví dụ: `Hàng ${seat.rowLabel} - Ghế ${seat.seatNumber}`).

- [ ] **Step 2: Kiểm tra biên dịch và lint trên Frontend**
      Run: `pnpm --filter @tickethub/web build`
      Expected: Build thành công không có lỗi TypeScript hay Next.js.

- [ ] **Step 3: Commit thay đổi Task 4**
  ```bash
  git add apps/web/src/app/\(event\)/events/\[id\]/page.tsx
  git commit -m "feat(web): integrate auto seat hold with backend booking api"
  ```

---

### Task 5: Kiểm tra toàn diện hệ thống và báo cáo hoàn thành

**Files:**

- Toàn bộ monorepo

- [ ] **Step 1: Chạy toàn bộ test suite của Backend**
      Run: `pnpm --filter @tickethub/api test:unit`
      Expected: Tất cả các file test (w02, w03, vnpay, search, event-cache, auto-seat-allocation) đều PASS.

- [ ] **Step 2: Chạy kiểm tra lint toàn dự án**
      Run: `pnpm lint`
      Expected: Không có lỗi ESLint nào phát sinh.

- [ ] **Step 3: Chạy Playwright E2E tests**
      Run: `pnpm test:e2e`
      Expected: 16/16 test scenarios PASS.
