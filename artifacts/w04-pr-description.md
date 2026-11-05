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
- [x] E2E W04 trên Chromium với API, PostgreSQL và Redis thật: 9/9 đạt
- [ ] `pnpm build`: shared/API build thành công; web bị chặn tải Inter và JetBrains Mono từ Google Fonts bởi chính sách mạng. Cần cho phép `fonts.googleapis.com`, `fonts.gstatic.com` rồi chạy lại trước khi đề nghị merge.

## 3. Cam kết chất lượng mã nguồn (Code Quality Guarantees)

Bắt buộc xác nhận toàn bộ các cam kết dưới đây:

- [x] Không chứa mã giả lập ở client (không dùng localStorage hoặc mock để thay thế API backend)
- [x] Không sử dụng kiểu `any` (dùng schema Zod hoặc kiểu `unknown` có kiểm tra kiểu)
- [x] Tuân thủ token màu tại `docs/DESIGN_TOKENS.md` (không dùng mã hex thô không khai báo)
- [x] Không chứa biểu tượng cảm xúc (emoji) trong commit message và nội dung trao đổi
- [x] Không chứa ký tự gạch ngang dài (em-dash) trong commit message và nội dung
- [x] Không can thiệp trái phép vào hạ tầng kiểm soát (không sửa đổi .github/workflows/, scripts/pr-gate-_, scripts/audit-doc-_, tests/pr-gate-*)

## 4. Danh sách ca kiểm thử (Test Cases)

1. Thiếu mã đơn hoặc đơn không tồn tại không sinh đơn giả, không hiện nút thanh toán.
2. Checkout đọc đúng tổng tiền và hạn giữ chỗ; voucher chưa được backend hỗ trợ không làm giảm tiền trên client; hủy đơn trả chỗ thật.
3. `vnp_ResponseCode=00` hoặc `paymentSuccess=true` trên URL không xác nhận thanh toán khi backend còn `PENDING`; rời checkout trả chỗ.
4. Vé có ghế hiển thị đúng hàng/ghế backend tự phân bổ, client chỉ gửi hạng vé và số lượng.
5. Lỗi kết nối thanh toán giữ người dùng tại checkout, hiển thị lỗi, đơn vẫn `PENDING`.
6. Đồng hồ tính lại theo deadline sau khi tab bị treo; cảnh báo dưới 60 giây; hết hạn gọi API giải phóng và trở về sự kiện.
7. Nút thanh toán dùng URL HTTPS VNPay backend cấp; chuyển VNPay không giải phóng đơn; đường quay về mặc định `/checkout/vnpay-return` truy xuất lại trạng thái đơn.
8. IPN ký bằng khóa fixture cục bộ cập nhật backend thật thành `PAID`; UI xem trước và hủy một trong hai vé, một vé còn hiệu lực, đơn vẫn `PAID`.

IPN trong test là thông điệp ký cục bộ qua endpoint thật. Không gửi thanh toán tới VNPay và không xác nhận giao dịch ngân hàng hoặc tiền hoàn thực tế.

9. F5 tại checkout không gửi yêu cầu hủy, đơn vẫn `PENDING`, `expiresAt` giữ nguyên và vẫn có thể hủy chủ động sau khi tải lại.

## 5. Ghi chú bổ sung (Additional Notes)

- F5 giữ nguyên phiên và hạn giữ chỗ. Rời checkout bằng điều hướng trong ứng dụng giải phóng chỗ; đóng tab hoặc thoát trình duyệt được backend thu hồi khi hết hạn, vì không thể dùng `pagehide` để phân biệt với tải lại trang.
- Phạm vi PR chỉ gồm checkout, kết quả thanh toán, đơn hàng, yêu cầu hoàn vé, schema và test liên quan. Trang chủ, header chung, danh mục minh họa và giao diện sự kiện giữ nguyên so với nhánh nền.
- Điểm tích hợp: luồng giữ chỗ hiện có phải tạo đơn thật rồi điều hướng tới `/checkout?orderId=<UUID>` từ phản hồi backend. PR này không sửa các ID sự kiện/hạng vé minh họa ở trang chủ hoặc trang sự kiện. Nếu dữ liệu đó không khớp database, cần xử lý trong phần việc tích hợp chọn vé riêng.
- E2E tạo đơn qua API thật trên database test rồi kiểm tra W04 từ checkout. Không dùng kết quả này để khẳng định luồng từ trang chủ của repository gốc đã được nghiệm thu.
- Routes: `/checkout?orderId=...`, `/checkout/result`, `/checkout/vnpay-return`, `/buyer/orders`, `/buyer/orders/[id]`; `/orders` chuyển về danh sách đơn hàng.
- UI hoàn vé dùng `/refund/preview` và `/refund/request`. Gửi lại khi kết quả chưa rõ sử dụng cùng `Idempotency-Key`. Vé thu hồi và tiền hoàn đang xử lý được diễn đạt riêng.
- Backend hiện không xử lý voucher, bankCode hay thay đổi người nhận tại endpoint tạo VNPay URL. UI không tự áp voucher hoặc gửi dữ liệu giả được backend bỏ qua. Thông tin người nhận lấy từ tài khoản, chọn QR/ATM/thẻ tại cổng VNPay. Cần phối hợp BE2 nếu bổ sung những khả năng này.
- VNPay sandbox thật vẫn cần thông tin merchant hợp lệ và `VNPAY_RETURN_URL` truy cập được. Mặc định `TEST_TMN_CODE`/`TEST_HASH_SECRET` bị backend từ chối; không dùng fixture kiểm thử làm cấu hình sandbox thật.
- Phần vé QR thuộc FE2 không được thay thế trong thay đổi này.
- Thông điệp commit theo Conventional Commits: `feat(web): implement W04 checkout and order refunds`.

### Cập nhật nhánh sau khi thu hẹp phạm vi

Nếu máy đã từng chạy phiên bản có thêm routes sự kiện, chạy `corepack pnpm --filter @tickethub/web exec next typegen` để tạo lại route types trong cache Next.js. Không sửa các tệp sinh tự động để xử lý lỗi cache.

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

![Checkout desktop](https://raw.githubusercontent.com/vikietduong/tickethub/811cbbf8ca6323133274af6cd7016bad550e425f/artifacts/w04-checkout-desktop.png)

![Checkout mobile](https://raw.githubusercontent.com/vikietduong/tickethub/811cbbf8ca6323133274af6cd7016bad550e425f/artifacts/w04-checkout-mobile.png)

![Xem trước hoàn một phần vé](https://raw.githubusercontent.com/vikietduong/tickethub/811cbbf8ca6323133274af6cd7016bad550e425f/artifacts/w04-refund-preview.png)
