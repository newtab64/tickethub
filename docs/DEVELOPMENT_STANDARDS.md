# Tiêu chuẩn phát triển và kỹ thuật hệ thống

Tài liệu này quy định các nguyên tắc kiến trúc, quy chuẩn mã nguồn và tiêu chuẩn kiểm thử áp dụng cho kỹ sư và các thành viên phát triển trên kho mã nguồn TicketHub.

## Nguyên tắc kiến trúc và dữ liệu

### Nguồn sự thật về tồn kho và giao dịch

Tồn kho vé, phiên giữ chỗ và giao dịch tiền tệ được quản lý tập trung trên PostgreSQL qua database transaction.

Redis được sử dụng cho việc giới hạn tần suất (rate limiting), lưu tạm dữ liệu truy vấn (cache), xuất bản thông điệp thời gian thực (Pub/Sub) và hàng đợi nền BullMQ. Không đưa ra quyết định xác nhận đặt chỗ hay thanh toán dựa trên dữ liệu lưu tạm trong bộ nhớ Redis.

### Cơ chế tự động phân bổ ghế (Auto Seat Allocation) và Kiểm soát tranh chấp

Nền tảng TicketHub không hỗ trợ người mua chọn từng vị trí ghế cụ thể trên sơ đồ; bản đồ SVG chỉ đóng vai trò hiển thị trực quan cấu trúc khu vực, hàng ghế và số lượng chỗ khả dụng. Khi người mua yêu cầu giữ chỗ theo `{ ticketTypeId, quantity }`, backend áp dụng thuật toán tự động phân bổ ghế liền kề:

1. **Thuật toán tìm ghế liền kề (`findContiguousSeats`, cài đặt tại `apps/api/src/contexts/booking/domain/seat-allocation.ts`)**:
   - Truy vấn toàn bộ ghế có trạng thái `AVAILABLE` (hoặc `HELD` đã quá hạn 5 phút) thuộc `ticketTypeId` trong sự kiện.
   - Gom nhóm các ghế khả dụng theo nhãn hàng ghế (`rowLabel`).
   - Sắp xếp các ghế trong từng hàng theo số thứ tự số nguyên tăng dần (`seatNumber`).
   - Tìm kiếm chuỗi `quantity` ghế có số ghế liên tiếp (`seatNumber[i+1] === seatNumber[i] + 1`).
   - Nếu hàng hiện tại bị phân mảnh hoặc đứt đoạn, thuật toán tự động bỏ qua và chuyển sang kiểm tra hàng tiếp theo có đủ số lượng ghế liền kề trong cùng hạng vé.
   - Trường hợp không có hàng nào đáp ứng đủ chuỗi liền kề, thuật toán fallback sang chọn `quantity` ghế trống có khoảng cách số gần nhau nhất trong cùng hàng khả dụng.

2. **Khóa mức hàng nguyên tử bằng `FOR UPDATE SKIP LOCKED`**:
   - Các ghế khả dụng được khóa bằng câu lệnh:
     ```sql
     SELECT id, seat_number, row_number FROM seats WHERE zone_id = $1 AND status = 'AVAILABLE' ORDER BY row_number ASC, seat_number ASC LIMIT $2 FOR UPDATE SKIP LOCKED;
     ```
   - Ghế đang bị giao dịch song song khóa sẽ được bỏ qua ngay thay vì chờ, nên các giao dịch đồng thời chọn các tập ghế khác nhau mà không chặn nhau. Mã không dùng vòng lặp thử lại giới hạn số lần.
   - Bắt buộc khóa theo thứ tự xác định để triệt tiêu nguy cơ deadlock giữa các transaction chạy đồng thời.
   - Nếu không còn đủ ghế trống đáp ứng yêu cầu, hệ thống trả về mã lỗi `INSUFFICIENT_TICKET_CAPACITY`.

Ràng buộc `UNIQUE (event_id, seat_id)` trên bảng `tickets` với điều kiện vé chưa bị hủy là lớp kiểm tra bắt buộc ở tầng cơ sở dữ liệu.

### Kiểm soát soát vé tại cổng

Lệnh check-in vé tại cổng phải thực thi qua một câu lệnh cập nhật nguyên tử:

```sql
UPDATE tickets SET status = 'CHECKED_IN', checked_in_at = now()
WHERE id = $1 AND status = 'SOLD' RETURNING id;
```

Chỉ chấp nhận vào cổng khi câu lệnh trả về đúng một dòng dữ liệu.

### Tính bất biến của bảng nhật ký

Bảng `audit_log` chỉ tiếp nhận thao tác ghi mới (`INSERT`). Không viết mã hoặc cung cấp quyền thực thi các câu lệnh `UPDATE` hoặc `DELETE` trên bảng này.

### Mẫu Transactional Outbox

Các thao tác gửi thông báo bên ngoài (email Resend/SES, SMS) không được gọi trực tiếp bên trong database transaction đang xử lý đơn hàng. Bản ghi sự kiện được ghi vào bảng `outbox` cùng transaction với đơn hàng; worker nền sẽ đọc bảng này và gửi đi với cơ chế thử lại có khoảng lùi thời gian (retry backoff).

### Ranh giới vai trò và Chống xung đột lợi ích (RBAC Boundaries & Anti-Conflict of Interest)

Hệ thống phân định ranh giới nghiêm ngặt giữa 4 vai trò người dùng nhằm ngăn ngừa xung đột lợi ích và bảo vệ quyền lợi người mua vé:

1. **Quản trị viên (`ADMIN`)**: Giám sát hệ thống, kiểm duyệt hồ sơ Ban tổ chức, phê duyệt sự kiện và đối soát quyết toán. Nghiêm cấm tài khoản Admin thực hiện thao tác giữ chỗ hoặc mua vé để tránh can thiệp quy trình vận hành và thiên vị lợi ích.
2. **Ban tổ chức (`ORGANIZER`)**: Tạo và quản lý sự kiện, cấu hình hạng vé, theo dõi doanh thu. Nghiêm cấm tài khoản Ban tổ chức mua vé sự kiện trên nền tảng nhằm triệt tiêu nguy cơ găm vé nội bộ, thao túng giá thị trường thứ cấp hoặc tự tạo giao dịch ảo.
3. **Người mua vé (`BUYER`)**: Vai trò người dùng cá nhân duy nhất được phép thực hiện giữ chỗ nguyên tử (`POST /booking/hold`), thanh toán đơn hàng qua VNPay và sở hữu vé điện tử QR.
4. **Nhân viên soát vé (`GATE_STAFF`)**: Được gán theo cổng sự kiện, chỉ sử dụng ứng dụng PWA quét mã QR xác thực vào cổng, không có quyền mua vé hay can thiệp dữ liệu sự kiện.

Toàn bộ các endpoint giữ chỗ (`/booking/*`), tạo giao dịch thanh toán (`/checkout/*`) và giao diện xem vé (`/my-tickets`) bắt buộc phải kiểm tra và chỉ cho phép vai trò `BUYER` ở cả tầng Routing (Next.js Edge Proxy) lẫn tầng API (NestJS RolesGuard).

## Quy chuẩn kiến trúc frontend theo tính năng

Frontend được chia thành các feature tại `apps/web/src/features/`; mô tả đầy đủ nằm trong [ARCHITECTURE.md](ARCHITECTURE.md). Quy chuẩn bắt buộc khi viết hoặc sửa mã frontend:

- Mỗi `page.tsx` và `route.ts` trong `src/app/` chỉ ghép nối: import màn hình hoặc proxy từ `@/features/<tên>` (hoặc `@/features/<tên>/server`) và không chứa logic hay giao diện. `page.tsx` không quá 40 dòng.
- `domain/` chỉ chứa kiểu và hàm thuần (không React, Next, DOM, fetch). Quy tắc nghiệp vụ phía client đặt ở đây và có test chạy bằng `node:test` mà không cần trình duyệt.
- `api/` chứa mọi lời gọi mạng, lưu trữ trình duyệt và xác thực; giao diện không gọi `fetch` trực tiếp.
- `ui/` chia màn hình lớn thành hook `use-*-screen.ts` và các khối trình bày; không để một tệp màn hình vượt quá vài trăm dòng khi có thể tách khối.
- Feature chỉ dùng feature khác qua `index.ts` (hoặc `server.ts` cho mã chạy trên máy chủ). Không import sâu vào `domain`, `api` hay `ui` của feature khác.
- `shared/` chỉ chứa mã không biết feature nào (api client, thành phần UI nền tảng, định dạng). Thành phần dùng ở một feature thì đặt trong feature đó.
- Dữ liệu tạm đặt ở `data/` kèm chú thích rõ là tạm; không trộn dữ liệu tạm vào `domain/` hay `ui/`.
- Không viết mã bắt chước dữ liệu thật (ví dụ tự đánh dấu thanh toán thành công khi API lỗi). Lỗi từ backend phải hiển thị cho người dùng.

Các quy tắc phụ thuộc được kiểm tra tự động bởi `apps/web/test/architecture.test.ts`; chạy bằng `pnpm --filter @tickethub/web test`.

## Quy chuẩn kiến trúc backend theo Domain-Driven Design

Backend được chia thành các bounded context tại `apps/api/src/contexts/`; mô tả đầy đủ và sơ đồ nằm trong [ARCHITECTURE.md](ARCHITECTURE.md). Phần này là các quy chuẩn bắt buộc khi viết hoặc sửa mã backend.

### Quy tắc tầng

- `domain/`: chỉ chứa mô hình, lỗi nghiệp vụ, hàm quy tắc thuần và cổng (interface). Không import NestJS, Drizzle, Redis, BullMQ, `database/`, `config/` hay context khác. Được dùng `@tickethub/shared`, `zod` và `node:*`.
- `application/`: use case là lớp TypeScript thuần, chỉ phụ thuộc vào cổng của `domain/`. Không dùng decorator NestJS và không truy cập cơ sở dữ liệu trực tiếp.
- `infrastructure/`: adapter cài đặt cổng (Drizzle, Redis, BullMQ, S3, VNPay, Resend, JWT). Không phụ thuộc `application/` hay `interface/`.
- `interface/`: controller, guard, bộ ánh xạ lỗi và entrypoint tiến trình. Kiểm tra dữ liệu vào bằng Zod rồi gọi use case; không chứa quy tắc nghiệp vụ.
- Các tệp `*.module.ts` và `*.composition.ts` ở gốc context là nơi duy nhất lắp ráp các tầng.

Quy tắc này được kiểm tra tự động bởi `apps/api/test/architecture.test.ts`. Một ngoại lệ mới chỉ được thêm vào danh sách cho phép trong tệp này kèm lý do và cập nhật mục "Ngoại lệ có chủ đích" của [ARCHITECTURE.md](ARCHITECTURE.md).

### Quy ước đặt tên và lỗi

- Use case đặt tên theo hành động nghiệp vụ: `XxxUseCase` cho một hành động, `XxxCommands` và `XxxQueries` (hoặc `XxxService`) cho nhóm lệnh và truy vấn của một khía cạnh.
- Cổng đặt tên theo vai trò (`...Repository`, `...Reader`, `...UnitOfWork`, `...Notifier`, `...Gateway`), adapter đặt tên theo công nghệ (`Drizzle...`, `Redis...`, `BullMq...`).
- Tầng `domain` ném lỗi riêng của context (ví dụ `PayoutDomainError`) với `kind` và mã lỗi ổn định; không ném ngoại lệ HTTP. Bộ ánh xạ ở `interface/` đổi sang ngoại lệ NestJS và giữ nguyên hình dạng phản hồi đã công bố trong [API_CONTRACT.md](API_CONTRACT.md).
- Tác động sang context khác (xóa cache, phát SSE, gửi thông báo) đi qua một cổng do context gọi định nghĩa, và chỉ thực hiện sau khi giao dịch cơ sở dữ liệu đã commit.

### Yêu cầu kiểm thử theo tầng

- Mọi quy tắc mới trong `domain/` có test đơn vị không cần cơ sở dữ liệu.
- Use case có nhánh lỗi hoặc điều phối phức tạp có test với cổng giả (tham số `overrides` của hàm lắp ráp).
- Adapter và các luồng ghi cốt lõi (tồn kho, thanh toán, hoàn tiền, soát vé, outbox) có test tích hợp trên PostgreSQL và Redis thật, theo [CONTRIBUTING.md](../CONTRIBUTING.md). Test tích hợp IPN của VNPay cần đặt `IPN_TEST_DB_NAME` trùng tên cơ sở dữ liệu kiểm thử đang dùng.

## Tiêu chuẩn mã nguồn

### Cấu hình TypeScript

Kho mã nguồn kích hoạt chế độ nghiêm ngặt trong `tsconfig.json`:

- `strict: true`
- `noUncheckedIndexedAccess: true`
- `exactOptionalPropertyTypes: true`

Không sử dụng kiểu `any`. Định nghĩa kiểu rõ ràng cho mọi tham số và giá trị trả về. Trường hợp dữ liệu chưa xác định từ bên ngoài, sử dụng `unknown` kết hợp hàm kiểm tra kiểu hoặc schema Zod.

### Tổ chức mã dùng chung

Toàn bộ schema xác thực Zod và interface TypeScript dùng chung giữa client và server phải được đặt trong package `packages/shared`.

## Các mẫu thiết kế bắt buộc

### Khóa Idempotency

Các endpoint tạo đơn, thanh toán và yêu cầu hoàn tiền yêu cầu header `Idempotency-Key`. Hệ thống kiểm tra và lưu kết quả vào bảng `idempotency_keys` với thời hạn tối thiểu 24 giờ để ngăn chặn việc gửi trùng yêu cầu.

### Khóa lạc quan (Optimistic Locking)

Các bảng `events`, `organizer_profiles` và `seats` chứa cột `version INT NOT NULL DEFAULT 1`. Khi cập nhật thông tin cấu hình sự kiện hoặc hồ sơ:

```sql
UPDATE events SET title = $1, version = version + 1
WHERE id = $2 AND version = $currentVersion RETURNING version;
```

Nếu không có dòng nào được cập nhật, trả về mã lỗi `CONFLICT_VERSION` (HTTP 409).

### Ký số mã QR động

Mã QR hiển thị trên ứng dụng là chuỗi JWS được ký bằng thuật toán Ed25519 (EdDSA) qua thư viện `jose`:

- `iat`: Thời điểm phát hành.
- `exp`: `iat + 30 seconds`.
- `jti`: Chuỗi định danh dùng một lần.

Khóa riêng (Private Key) được lưu trong trình quản lý bí mật (Secret Manager); ứng dụng soát vé chỉ lưu khóa công khai (Public Key) để xác thực tính toàn vẹn và nguồn gốc của token.

## Yêu cầu kiểm thử

### Kiểm thử giữ chỗ và thanh toán

Logic giữ chỗ và soát vé bắt buộc có test tích hợp chạy trên PostgreSQL thật qua thư viện Testcontainers. Không dùng mock cơ sở dữ liệu cho các logic này.

Mỗi thay đổi liên quan đến tồn kho phải đi kèm kịch bản kiểm thử đồng thời (tối thiểu 50 yêu cầu tranh chấp cùng một ghế) để xác nhận chỉ có một yêu cầu thành công.

### Kiểm thử tích hợp cổng thanh toán

Kiểm thử xử lý webhook IPN VNPay phải bao gồm các trường hợp:

- Chữ ký HMAC không khớp.
- Gửi trùng lặp nhiều webhook cho cùng một giao dịch.
- Webhook trả về sau khi đơn hàng đã hết hạn giữ chỗ (xử lý cấp vé nếu ghế còn trống hoặc kích hoạt hoàn tiền tự động).
- Phản hồi timeout từ cổng thanh toán (kiểm tra luồng gọi API truy vấn trạng thái giao dịch).

## Tuân thủ quy định và định dạng

### Ngôn ngữ và tiền tệ

Giao diện mặc định sử dụng tiếng Việt qua thư viện `next-intl`. Số tiền hiển thị theo định dạng VNĐ (ví dụ: `500.000 đ`). Múi giờ mặc định cho hiển thị lịch sự kiện là `Asia/Ho_Chi_Minh` (UTC+7).

### Dữ liệu cá nhân

Hệ thống tuân thủ Nghị định 13/2023/NĐ-CP về bảo vệ dữ liệu cá nhân. Biểu mẫu đăng ký yêu cầu bước người dùng đồng ý điều khoản xử lý dữ liệu. Bản ghi nhật ký hệ thống không in mật khẩu thô, thông tin thẻ thanh toán hoặc dữ liệu định danh nhạy cảm.
