# W05-FE1: tích hợp backend PR #49

## Nguồn đối chiếu và phạm vi

Frontend được sửa theo [PR newtab64/tickethub#49](https://github.com/newtab64/tickethub/pull/49), head `ff96dd378850072830fcab73aa5620c6c8b42d71` tại lúc kiểm tra. Đã đọc controller, schema, staff service, reporting service, truy vấn SQL và tài liệu `docs/testing/w05-be2-integration.md` trong PR. Hợp đồng đề xuất cũ của FE1 đã được thay bằng hợp đồng thực tế này.

Chỉ thay đổi frontend và test/tài liệu frontend. Không merge hoặc sao chép mã API PR49 vào nhánh FE, không sửa workflow, schema DB hoặc lockfile. Backend hiện có trên nền `unstable` của nhánh FE chưa có module W05; để chạy tích hợp phải bật backend PR49 cùng các migration/phần W04 mà PR kế thừa.

Các route: `/organizer/staff`, `/organizer/dashboard`, `/organizer/events/[id]/stats`, `/organizer/gate-monitor`. Dùng danh sách sự kiện thật. W05 chỉ cho ORGANIZER theo `@Roles("ORGANIZER")` của PR49; ADMIN không được xem các màn hình chức năng này dù layout organizer hiện cho ADMIN đi qua.

## Nhân viên và cổng

| API sau `/api/v1`                                       | Frontend sử dụng                                                |
| ------------------------------------------------------- | --------------------------------------------------------------- |
| GET `/organizer/staff?page=1&limit=20`                  | Danh sách tài khoản của BTC; giữ `meta` phân trang              |
| POST `/organizer/staff`                                 | `{email,fullName,password,phone?}`; không gửi eventId/gateId    |
| PATCH `/organizer/staff/:userId`                        | `{status:"ACTIVE"                                               | "LOCKED"}`; khóa tài khoản toàn cục |
| GET `/organizer/events/:eventId/gates?page=1&limit=100` | Duyệt các trang theo `meta.hasMore`, không dừng cứng ở 100 cổng |
| POST `/organizer/events/:eventId/gates`                 | `{name,locationDesc?}`                                          |
| GET `/organizer/events/:eventId/staff?page=1&limit=100` | Phân công sự kiện; duyệt hết theo meta                          |
| POST `/organizer/events/:eventId/staff`                 | `{userId,gateId}`; tạo hoặc thay cổng                           |
| DELETE `/organizer/events/:eventId/staff/:userId`       | Bỏ phân công sự kiện                                            |

Tạo tài khoản và phân công là hai thao tác độc lập: UI không báo đã phân công khi chỉ tạo tài khoản thành công. Tài khoản có thể tạo ngay cả khi chưa có cổng. Họ tên 1..150 ký tự, email tối đa 255 và chuyển chữ thường, mật khẩu 12..128 ký tự, điện thoại tối đa 20. Không giữ mật khẩu ở localStorage/log.

ID phân công `event_staff.id` khác `userId`. Adapter ghép bằng userId; PATCH và DELETE dùng user ID. Tài khoản LOCKED không được gán cổng mới. Trạng thái khóa được xác nhận trong dialog và ghi rõ tác động toàn bộ sự kiện. Tìm kiếm hiện áp dụng trên trang tài khoản đang xem; phân trang theo hasMore, không giả tổng số bản ghi.

## Báo cáo UC09

`GET /organizer/events/:eventId/reports?fromDate=YYYY-MM-DD&toDate=YYYY-MM-DD&ticketTypeId=UUID&voucherCode=SUMMER`

Schema BE là strict. Không gửi các trường cũ `from`, `to`, `timezone`. Ngày bao gồm trọn hai đầu theo Việt Nam; ticketTypeId/voucherCode là tùy chọn, voucher trim/chuyển hoa, tối đa 50 ký tự. Danh sách hạng vé từ API chi tiết sự kiện organizer.

Payload giữ nguyên cấu trúc BE `{summary,sales,analytics,period}`:

- `summary.total_sold_tickets`: vé SOLD/CHECKED_IN, không bao gồm CANCELLED.
- `total_checked_in_tickets`, `checkin_percentage`: nhóm vé của kỳ thanh toán và trạng thái hiện tại.
- `paid_revenue`: tiền thực thu đã phân bổ voucher theo ngày thanh toán.
- `total_refunded_amount`: tiền hoàn COMPLETED theo ngày hoàn tất, không gán ngược ngày giao dịch gốc.
- `net_revenue`: tiền thu trừ hoàn, **có thể âm**, chưa trừ phí. UI dùng nhãn “Tiền thu sau hoàn”, không gọi là khoản chi trả cuối cùng.
- `analytics.cancellationPercentage`: tỷ lệ hủy; phí trả `NOT_CONFIGURED` và null, UI không đổi null thành 0.
- `sales[].paid_revenue`: gộp theo sale_date cho biểu đồ tiền thực thu và theo ticket_type_id cho bảng hạng vé. Không dùng sales làm biểu đồ doanh thu sau hoàn vì nó không chứa các dòng hoàn tiền.
- `summary.refreshed_at`: thời điểm dữ liệu được cập nhật, không phải lúc request. Độ trễ MV + cache có thể khoảng 6 phút; nút làm mới không ép worker refresh.
- `summary:null`: chưa có snapshot tổng hợp, hiển thị trạng thái chờ, không giả tất cả chỉ số bằng 0.

Adapter kiểm tra runtime các số SQL có thể là chuỗi; timestamp từ raw SQL có dạng `2026-11-13 06:39:59.498245+00` trong khi Drizzle trả ISO. Cả hai được xử lý, không vô hiệu hóa kiểm tra payload.

## Xuất báo cáo nền và tải có xác thực

- POST `/organizer/events/:eventId/reports/exports`: `{format:"csv"|"xlsx",fromDate,toDate,ticketTypeId?,voucherCode?}`, HTTP 202; không dùng đường dẫn `/report-exports` hoặc yêu cầu Idempotency-Key không có trong PR.
- GET cùng đường dẫn với `?page=1&limit=20`: lịch sử có meta, chỉ job của người yêu cầu. UI khôi phục từ đây sau F5.
- GET `.../reports/exports/:exportId`: trạng thái trước lúc tải.
- GET `.../reports/exports/:exportId/download`: tệp nhị phân, yêu cầu Bearer token.

Trạng thái: PENDING, PROCESSING, COMPLETED, FAILED, EXPIRED. UI poll danh sách mỗi 3 giây khi trang hiện tại có job đang chờ/xử lý và tab đang mở; dừng khi lỗi và cho cập nhật lại. Phân trang lịch sử và bộ lọc lưu trong job giúp phân biệt kỳ xuất với kỳ dashboard đang xem. Backend giới hạn 3 job pending/processing cho mỗi tài khoản; frontend không tự retry POST.

Không mở downloadUrl tương đối trực tiếp bằng thẻ a hoặc gửi token trong query URL. UI gọi endpoint download chuẩn hóa bằng eventId/exportId, kèm Bearer và cơ chế refresh 401 hiện có, rồi tải Blob. Không dùng URL tùy ý do response cung cấp. Lỗi 409 chưa xong, 410 hết hạn, 404 thiếu file không tạo tệp HTML/JSON giả. Có xử lý EXPIRED/FAILED và tải lại lịch sử sau F5.

API và worker phải trỏ cùng DB, cùng `REPORT_EXPORT_DIR`; nếu không worker vẫn tạo file nhưng API tải trả 404. Job lấy snapshot tại lúc worker chạy, số liệu có thể khác lần xem dashboard trước đó.

## Giám sát cổng

- GET `/organizer/events/:eventId/checkins/summary`: `generatedAt`, `suggestedPollIntervalMs`, `summary`, `gates`, `timelineLast24Hours`.
- GET `/organizer/events/:eventId/checkins?page=1&limit=20`: lịch sử có meta, bao gồm SUCCESS và REJECTED.

UI tách số vé đã check-in, số vé còn lại và số lượt quét thành công/từ chối. Theo từng cổng có checkedInTickets, activeAssignedStaff, successfulAttempts, rejectedAttempts, lastScanAt. Cho phép gateId/gateName null, không tự bịa tên cổng/nhân viên. Lịch sử API chỉ có staffId nên UI hiển thị mã nhân viên, không giả tên. Có bảng lưu lượng 24 giờ.

Poll summary ít nhất mỗi 5 giây theo gợi ý BE; lịch sử tự cập nhật ở trang 1. Có tạm dừng/tiếp tục, làm mới, phân trang, dừng poll khi tab ẩn hoặc lỗi và cảnh báo snapshot cũ. Không nhầm thống kê trực tiếp toàn sự kiện với báo cáo theo kỳ thanh toán.

## Cách chạy và kiểm tra

Cần PostgreSQL/Redis, backend PR49 đã migrate/seed và report worker. Trong môi trường cloud đã kiểm tra bằng bản mã PR49 tách ở `/tmp/tickethub-pr49-runtime`, DB riêng `tickethub_pr49_test`, Redis DB 2, API 4001. Không thay checkout backend hiện có của nhánh FE.

Có thể chuẩn bị bản backend ở thư mục riêng mà không merge vào nhánh frontend:

```bash
# Tại repo FE
mkdir -p ../tickethub-be2-w05
git fetch https://github.com/newtab64/tickethub.git refs/pull/49/head:refs/remotes/upstream/pr-49
git archive refs/remotes/upstream/pr-49 | tar -x -C ../tickethub-be2-w05
```

Chỉ dùng thư mục đích mới/rỗng; chạy pnpm install frozen trong bản backend. Khởi động PostgreSQL/Redis bằng Docker Compose của repo FE; tạo DB test riêng chưa tồn tại. Đặt DATABASE_URL vào DB đó và REDIS_URL vào Redis DB riêng, chạy shared build, API build, db:migrate, db:seed trong bản backend. Không migrate đè lên DB có dữ liệu đang dùng của nhánh khác.

Ba tiến trình cần chạy với môi trường nhất quán:

```bash
# Terminal API, tại bản backend PR49; giữ DATABASE_URL/REDIS_URL đã đặt cho DB test
PORT=4001 REPORT_EXPORT_DIR=/tmp/w05-report-files pnpm --filter @tickethub/api start

# Terminal worker, tại cùng bản backend, cùng DATABASE_URL/REDIS_URL và thư mục tệp
REPORT_EXPORT_DIR=/tmp/w05-report-files ENABLE_REPORT_EMAIL_DELIVERY=false pnpm --filter @tickethub/api start:report-worker

# Terminal web, tại repo FE
NEXT_PUBLIC_API_URL=http://localhost:4001/api/v1 pnpm --filter @tickethub/web dev
```

Đăng nhập tài khoản seed `organizer@tickethub.vn` với mật khẩu seed `Password123!`, mở ba route ở đầu tài liệu. Khi đổi NEXT_PUBLIC_API_URL phải khởi động lại dev web. Trên Windows PowerShell, đặt từng biến bằng `$env:TEN_BIEN='...'` thay cú pháp prefix Bash.

Kiểm tra frontend và hợp đồng (10 test Chromium có fixture response):

```bash
pnpm --filter @tickethub/web test
pnpm --filter @tickethub/web exec tsc --noEmit
pnpm --filter @tickethub/web lint
W05_API_URL=http://localhost:4001/api/v1 pnpm --filter @tickethub/web test:e2e test/w05-organizer-operations.spec.ts --project=chromium --workers=1
```

Kiểm tra tích hợp thật, không mock response:

```bash
W05_API_URL=http://localhost:4001/api/v1 W05_LIVE_TESTS=1 pnpm --filter @tickethub/web test:e2e test/w05-backend.integration.spec.ts --project=chromium --workers=1
```

Chỉ bật live tests với DB kiểm thử riêng. Suite tạo tài khoản/cổng fixture; sau test bỏ phân công và khóa tài khoản. Backend không có API xóa tài khoản/cổng nên giữ các bản ghi fixture trong DB test. Suite yêu cầu report worker để hoàn tất job và kiểm tra nội dung CSV/XLSX tải thật. Không gửi email/payment/provider thật.

Cloud dùng Chromium hệ thống thì thêm `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/usr/bin/chromium`. Test mặc định dùng `http://localhost:3000`; giữ API/web đang chạy để Playwright tái sử dụng. Build production vẫn cần quyền tải Google Fonts (`fonts.googleapis.com`, `fonts.gstatic.com`); không thay logic ứng dụng hoặc tắt TLS để né lỗi môi trường.

Cần review chéo FE2 trước merge. Tích hợp đã đối chiếu với head PR49 nêu trên; nếu BE2 đổi hợp đồng ở commit sau, cần kiểm tra lại adapter và test.
