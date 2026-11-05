# feat(web): implement W04 FE1 checkout and buyer order refunds

Đích PR: `unstable`. Nhánh triển khai: `feat/w04-fe1-checkout`, tạo từ `origin/unstable` tại `db380e153063aa83b94415e694e81f433352822a`.

Checkout trước đây dùng đơn mẫu và có thể điều hướng sang kết quả thành công khi API thanh toán lỗi. Thay đổi này đọc đơn giữ chỗ thật, hiển thị tiền do backend xác nhận, chuyển tới VNPay và chỉ công nhận thanh toán thành công khi API trả trạng thái `PAID`.

## 1. Loại thay đổi (PR Type)

- [x] `feat`: Tính năng mới
- [x] `fix`: Sửa lỗi hệ thống
- [ ] `docs`: Cập nhật tài liệu
- [ ] `refactor`: Tái cấu trúc mã nguồn
- [ ] `chore`: Cấu hình công cụ, nâng cấp thư viện

## 2. Kiểm tra kỹ thuật trước khi gửi (Pre-flight Checks)

- [x] `pnpm typecheck`
- [x] `pnpm lint`
- [x] `pnpm format:check`
- [x] `pnpm test`: 191 test API và 32 test web đạt, không bỏ qua test
- [x] `node scripts/audit-doc-parity.mjs`
- [x] E2E W04 trên Chromium với API, PostgreSQL và Redis thật: 11/11 đạt
- [ ] `pnpm build`: shared/API build thành công; web bị chặn tải Inter và JetBrains Mono từ Google Fonts bởi chính sách mạng. Cần cho phép `fonts.googleapis.com`, `fonts.gstatic.com` rồi chạy lại trước khi đề nghị merge.

## 3. Cam kết chất lượng mã nguồn (Code Quality Guarantees)

- [x] Không dùng dữ liệu mẫu hoặc localStorage để thay thế API đơn hàng, thanh toán hoặc hoàn tiền. sessionStorage chỉ giữ mã đơn và mã giao dịch cho điều hướng quay về; kết quả luôn đọc lại từ API có xác thực.
- [x] Không dùng kiểu `any` mới. Dữ liệu trả về được kiểm tra bằng schema Zod trong `packages/shared`.
- [x] Màu giao diện mới dùng design tokens.
- [x] Không có emoji hoặc ký tự gạch ngang dài trong mã và mô tả thay đổi mới.
- [x] Không sửa `.github/workflows/`, `scripts/pr-gate-*`, `scripts/audit-doc-*`, `tests/pr-gate-*` hoặc mẫu PR.

## 4. Danh sách ca kiểm thử (Test Cases)

1. Thiếu mã đơn hoặc đơn không tồn tại không sinh đơn giả, không hiện nút thanh toán.
2. Checkout đọc đúng tổng tiền và hạn giữ chỗ; voucher chưa được backend hỗ trợ không làm giảm tiền trên client; hủy đơn trả chỗ thật.
3. `vnp_ResponseCode=00` hoặc `paymentSuccess=true` trên URL không xác nhận thanh toán khi backend còn `PENDING`; rời checkout trả chỗ.
4. Vé có ghế hiển thị đúng hàng/ghế backend tự phân bổ, client chỉ gửi hạng vé và số lượng.
5. Lỗi kết nối thanh toán giữ người dùng tại checkout, hiển thị lỗi, đơn vẫn `PENDING`.
6. Đồng hồ tính lại theo deadline sau khi tab bị treo; cảnh báo dưới 60 giây; hết hạn gọi API giải phóng và trở về sự kiện có thông báo.
7. Nút thanh toán dùng URL HTTPS VNPay backend cấp; chuyển VNPay không giải phóng đơn; đường quay về mặc định `/checkout/vnpay-return` truy xuất lại trạng thái đơn.
8. IPN ký bằng khóa fixture cục bộ cập nhật backend thật thành `PAID`; UI xem trước và hủy một trong hai vé, một vé còn hiệu lực, đơn vẫn `PAID`.

IPN trong test là thông điệp ký cục bộ qua endpoint thật. Không gửi thanh toán tới VNPay và không xác nhận giao dịch ngân hàng hoặc tiền hoàn thực tế.

9. Từ trang chủ chọn sự kiện trả về từ API, sang chi tiết và trang đặt vé; chọn hạng vé, số lượng rồi giữ chỗ bằng UUID thật để vào checkout.
10. Mở đường dẫn danh mục mẫu cũ không tạo request giữ chỗ với ID giả; hiển thị lỗi và liên kết tới sự kiện thật.

11. F5 tại checkout không gửi yêu cầu hủy, đơn vẫn `PENDING`, `expiresAt` giữ nguyên và vẫn có thể hủy chủ động sau khi tải lại.

## 5. Ghi chú bổ sung (Additional Notes)

- F5 giữ nguyên phiên và hạn giữ chỗ. Rời checkout bằng điều hướng trong ứng dụng giải phóng chỗ; đóng tab hoặc thoát trình duyệt được backend thu hồi khi hết hạn, vì không thể dùng `pagehide` để phân biệt với tải lại trang.
- Luồng vào checkout dùng danh sách và hạng vé từ API, không dùng ID cố định của danh mục minh họa. Trang chi tiết và trang đặt vé tách biệt.
- Routes: `/events`, `/events/[slug]`, `/events/[slug]/booking`, `/checkout?orderId=...`, `/checkout/result`, `/checkout/vnpay-return`, `/buyer/orders`, `/buyer/orders/[id]`; `/orders` chuyển về danh sách đơn hàng.
- UI hoàn vé dùng `/refund/preview` và `/refund/request`. Gửi lại khi kết quả chưa rõ sử dụng cùng `Idempotency-Key`. Vé thu hồi và tiền hoàn đang xử lý được diễn đạt riêng.
- Backend hiện không xử lý voucher, bankCode hay thay đổi người nhận tại endpoint tạo VNPay URL. UI không tự áp voucher hoặc gửi dữ liệu giả được backend bỏ qua. Thông tin người nhận lấy từ tài khoản, chọn QR/ATM/thẻ tại cổng VNPay. Cần phối hợp BE2 nếu bổ sung những khả năng này.
- VNPay sandbox thật vẫn cần thông tin merchant hợp lệ và `VNPAY_RETURN_URL` truy cập được. Mặc định `TEST_TMN_CODE`/`TEST_HASH_SECRET` bị backend từ chối; không dùng fixture kiểm thử làm cấu hình sandbox thật.
- Phần vé QR thuộc FE2 không được thay thế trong thay đổi này.
- Thông điệp commit theo Conventional Commits: `feat(web): implement W04 checkout and order refunds`.

### Chạy lại E2E W04

Chạy API riêng trên database tạm `_test` với PostgreSQL/Redis thật, migration và seed. Không trỏ E2E vào database phát triển hoặc dữ liệu người dùng. Ví dụ với database mới `tickethub_w04_test` và cổng API 4000:

```bash
docker exec tickethub-postgres createdb -U tickethub tickethub_w04_test
DATABASE_URL=postgresql://tickethub:tickethub_secret@localhost:5432/tickethub_w04_test corepack pnpm db:migrate
DATABASE_URL=postgresql://tickethub:tickethub_secret@localhost:5432/tickethub_w04_test corepack pnpm db:seed
NODE_ENV=test DATABASE_URL=postgresql://tickethub:tickethub_secret@localhost:5432/tickethub_w04_test ENABLE_VNPAY_IPN_PROCESSING=true VNPAY_TMN_CODE=W04LOCALTEST VNPAY_HASH_SECRET=w04-local-signature-fixture-only node apps/api/dist/main.js
```

Các giá trị ký ở đây chỉ là fixture cho test cục bộ, không phải thông tin đăng nhập VNPay. Chạy web dev riêng tại cổng 3000. Khi đã sẵn sàng, chạy từ thư mục gốc repository:

```bash
W04_E2E_ISOLATED=true W04_IPN_TEST=true PLAYWRIGHT_CHROMIUM_EXECUTABLE=/usr/bin/chromium corepack pnpm --filter @tickethub/web exec playwright test test/w04-checkout.spec.ts --project=chromium --workers=1 --reporter=list
```

Có thể bỏ `PLAYWRIGHT_CHROMIUM_EXECUTABLE` nếu đã cài browser Playwright. Suite không chạy khi thiếu cờ xác nhận database riêng; hai ca phụ thuộc IPN cần thêm `W04_IPN_TEST=true`. Sau suite, dừng API test và xóa database tạm do lần chạy này tạo để dọn toàn bộ fixture:

```bash
docker exec tickethub-postgres dropdb -U tickethub tickethub_w04_test
```

Trong môi trường này, dùng Node 24.22.1, pnpm 12.11.2 và các biến thư mục cache đã thiết lập trong onboarding. API phát triển phải được khởi động lại với database phát triển sau kiểm thử.

## 6. Minh chứng trực quan (Visual Evidence)

Ảnh được chụp từ Chromium chạy ứng dụng với dữ liệu backend thật trên database test. Đính kèm các ảnh này vào PR khi gửi review.

![Checkout desktop](w04-checkout-desktop.png)

![Checkout mobile](w04-checkout-mobile.png)

![Xem trước hoàn một phần vé](w04-refund-preview.png)

![Checkout đi từ trang chủ với sự kiện thật](w04-live-entry-checkout.png)

![Chọn hạng vé thật từ API](w04-live-booking.png)
