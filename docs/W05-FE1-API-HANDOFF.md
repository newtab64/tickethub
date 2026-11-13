# W05-FE1: bàn giao giao diện và API cho BE2

## Phạm vi và trạng thái

Theo dòng W05-FE1 của dutyRoster.xlsx: quản lý nhân viên, báo cáo doanh thu UC09, xuất CSV/Excel nền và giám sát cổng. Chỉ thay đổi frontend theo yêu cầu người dùng. Không triển khai phần camera/QR của FE2.

Giao diện: `/organizer/staff`, `/organizer/dashboard`, `/organizer/events/[id]/stats`, `/organizer/gate-monitor`. Các route dùng kiểm tra phiên và vai trò ORGANIZER/ADMIN hiện có. API client dùng Bearer token, refresh cookie và xử lý lỗi hiện có. Danh sách sự kiện lấy API thật, không dùng danh sách mock của màn hình sự kiện cũ.

**Đây là hợp đồng đề xuất để BE2 xác nhận và triển khai, chưa phải API đang có.** Backend hiện chỉ cung cấp `GET /api/v1/organizer/events` và các API chi tiết/cập nhật sự kiện liên quan. Không dùng `/gate/scan`, `/gate/lookup` hoặc inventory công khai để suy diễn báo cáo. Giao diện hiển thị lỗi khi endpoint chưa tồn tại, không tạo tài khoản, doanh thu hoặc tệp giả. Test trình duyệt với response fixture chỉ xác minh frontend, không chứng minh tích hợp backend W05.

## Quy ước chung

- Prefix `/api/v1/organizer/events/:eventId`; UUID hợp lệ.
- Mọi endpoint mới yêu cầu Bearer token và xác thực quyền sở hữu sự kiện phía máy chủ. Không tin eventId/userId/role từ trình duyệt. ADMIN tuân theo chính sách truy cập của backend.
- Thành công: `{ "success": true, "data": ... }`. Lỗi: `{ "success": false, "error": { "code": "...", "message": "..." } }`.
- 400: dữ liệu không hợp lệ; 401: hết phiên; 403: không có quyền; 404: không tìm thấy; 409: trùng email/tranh chấp; 429: giới hạn tần suất; 501: chưa hỗ trợ. Không trả HTTP 200 với payload giả khi dịch vụ lỗi.
- Đếm là số nguyên không âm; tiền là số VND hữu hạn không âm. Timestamp ISO 8601 có múi giờ. Giao diện kiểm tra runtime schema tại `apps/web/src/features/organizer/domain/operations.ts`.

## Danh sách sự kiện hiện có

`GET /api/v1/organizer/events`: frontend đọc `data.items[].{id,title}`, bỏ qua các trường bổ sung. Backend hiện xác minh hồ sơ BTC trước khi trả danh sách; lỗi xác minh vẫn hiển thị nguyên trạng.

## Nhân viên soát vé

| Method | Path sau prefix   | Dữ liệu                                                            |
| ------ | ----------------- | ------------------------------------------------------------------ |
| GET    | `/staff`          | `{ items: Staff[], gates: Gate[] }`                                |
| POST   | `/staff`          | Body `{ fullName, email, password, gateId }`, HTTP 201 trả `Staff` |
| PATCH  | `/staff/:staffId` | Body `{ gateId? , status? }`, HTTP 200 trả `Staff`                 |

`Staff = { id: UUID, fullName: string, email: string, status: "ACTIVE" | "LOCKED", gateId: UUID | null }`.
`id` là user ID của nhân viên, không phải ID dòng event_staff. `Gate = { id: UUID, name: string }`.

- Họ tên 2..100 ký tự sau trim, email hợp lệ, mật khẩu 12..128 ký tự. Không trả mật khẩu/hash trong response hoặc log. Backend băm mật khẩu và gán role GATE_STAFF, tạo phân công nguyên tử.
- Cổng phải thuộc eventId, nhân viên phải được phép quản lý bởi BTC này. Không được đổi vai trò hoặc trạng thái của tài khoản người mua/BTC bằng endpoint này.
- Trùng email trả 409, không tự động chiếm tài khoản có sẵn. Muốn hỗ trợ tài khoản có sẵn cần hợp đồng riêng.
- `LOCKED` là khóa tài khoản toàn cục, không chỉ bỏ phân công ở sự kiện. Backend phải chặn phiên/token còn hiệu lực khi scan/lookup và đăng nhập. BE2 cần chốt chính sách nhân viên dùng chung nhiều BTC trước khi triển khai; không cho một BTC khóa tài khoản thuộc BTC khác.
- Giao diện xác nhận trước khi khóa/mở khóa, chỉ thông báo thành công sau response, tải lại danh sách sau mutation. Chưa có cổng thì không cho tạo nhân viên.

## Báo cáo doanh thu

`GET /reports?from=YYYY-MM-DD&to=YYYY-MM-DD&timezone=Asia%2FHo_Chi_Minh`

`from`, `to` là ngày Việt Nam, gồm cả hai đầu. Backend chuyển thành `[from 00:00 +07:00, ngày sau to 00:00 +07:00)`; không tính theo timezone máy chủ. Từ ngày không được sau đến ngày.

```json
{
  "updatedAt": "2026-11-06T10:00:00+07:00",
  "revenue": 1800000,
  "ticketsSold": 3,
  "checkedIn": 2,
  "daily": [{ "date": "2026-11-06", "revenue": 1800000 }],
  "ticketTypes": [{ "name": "VIP", "sold": 3, "revenue": 1800000 }]
}
```

- `revenue`: doanh thu thuần của thanh toán thành công trong kỳ, trừ hoàn tiền hoàn tất liên quan, phân bổ voucher theo giá thực trả. Không tính giữ chỗ, đơn chờ, thanh toán lỗi hoặc đếm IPN lặp.
- `ticketsSold`: vé còn hiệu lực (SOLD/CHECKED_IN) thuộc các thanh toán trong kỳ. `checkedIn`: tập con đã vào cổng của chính các vé đó, không phải mọi lượt scan trong kỳ. `checkedIn <= ticketsSold`; mẫu số 0 hiển thị 0%.
- `daily`: ngày tăng dần, duy nhất, doanh thu theo ngày thanh toán, hoàn tiền áp vào giao dịch gốc. `ticketTypes`: cùng phạm vi và cách tính. Tổng các nhóm/ngày phải khớp tổng chung. Trả ngày thiếu là 0 hoặc bỏ ngày không giao dịch; không trả trùng ngày.
- `updatedAt` là thời điểm dữ liệu tổng hợp thực sự được cập nhật, không chỉ giờ trả HTTP. BE2 phụ trách materialized view/cache theo phân công; UI không yêu cầu biết chi tiết triển khai.
- Khoảng rỗng trả tổng 0 và mảng rỗng. Frontend hiển thị kỳ đang áp dụng riêng với bản nháp bộ lọc.

## Xuất CSV/Excel bất đồng bộ

`POST /report-exports` với header `Idempotency-Key: UUID`, body `{ from, to, timezone: "Asia/Ho_Chi_Minh", format: "csv" | "xlsx" }`. HTTP 202 trả `ExportJob`.

`GET /report-exports/:jobId`: HTTP 200 trả `ExportJob`.

```json
{
  "id": "10000000-0000-4000-8000-000000000001",
  "status": "QUEUED",
  "downloadUrl": null,
  "error": null
}
```

- Chu trình `QUEUED -> PROCESSING -> COMPLETED | FAILED`; `COMPLETED` bắt buộc có `downloadUrl` HTTPS có chữ ký và hạn dùng; `FAILED` có mã/thông báo lỗi an toàn. Không trả URL javascript/data/http hoặc credential trong URL.
- Job thuộc người dùng và sự kiện; GET không làm lộ job của BTC khác. Lặp cùng idempotency key/body phải trả cùng job; khác body trả 409. Frontend không tự retry POST khi mất kết nối.
- UI poll mỗi 3 giây khi mở trang, dừng khi kết thúc/lỗi đọc trạng thái, có nút kiểm tra lại; không tạo job đồng bộ trong trình duyệt. Kỳ và định dạng lúc gửi được giữ bên cạnh trạng thái để tránh nhầm khi đổi bộ lọc.
- Backend tạo CSV UTF-8/Excel đúng định dạng, chống CSV formula injection, bảo vệ dữ liệu cá nhân, đặt Content-Disposition attachment. Không trả HTML đội lốt xlsx. Job và tệp cần TTL/rate limit phù hợp.
- Hiện trạng job ở trong bộ nhớ trang; rời trang/tải lại sẽ mất theo dõi trên UI. API danh sách job và khôi phục qua URL là phần bổ sung nếu cần, chưa có hợp đồng.

## Giám sát cổng

`GET /gate-monitor` trả snapshot nhất quán của cả sự kiện (không dùng bộ lọc kỳ doanh thu):

```json
{
  "updatedAt": "2026-11-06T10:00:00+07:00",
  "gates": [
    {
      "id": "10000000-0000-4000-8000-000000000001",
      "name": "Cổng A",
      "checkedIn": 2,
      "staffCount": 1
    }
  ],
  "recent": [
    {
      "id": "20000000-0000-4000-8000-000000000001",
      "gateName": "Cổng A",
      "staffName": "Nhân viên A",
      "checkedInAt": "2026-11-06T09:59:58+07:00"
    }
  ]
}
```

- `checkedIn`: tổng check-in thành công duy nhất tại cổng. `staffCount`: nhân viên được phân công có tài khoản ACTIVE, không phải chỉ số online.
- `recent`: tối đa 50 check-in thành công gần nhất, mới nhất trước; ID duy nhất của lượt check-in. Không lộ ticketCode, QR token hoặc thông tin liên hệ người mua.
- Frontend poll 5 giây, dừng khi ẩn tab hoặc lỗi, có tạm dừng/tiếp tục và làm mới. Khi lỗi giữ snapshot cũ kèm cảnh báo và thời điểm cập nhật; không gắn nhãn đang trực tiếp khi mất kết nối. Nếu cần SSE, BE2 và FE1 phải thống nhất endpoint/event/auth riêng.

## Tiêu chí nghiệm thu khi BE2 sẵn sàng

1. BTC A tạo, gán lại cổng, khóa/mở khóa nhân viên thành công; BTC B không đọc/sửa được. Nhân viên bị khóa không thể tiếp tục scan với token cũ.
2. Số liệu báo cáo khớp DB với voucher, hoàn tiền, thanh toán lỗi, IPN lặp và giao dịch sát 00:00 UTC+7.
3. Xuất cả CSV và Excel đi qua trạng thái nền, tải tệp đúng kỳ, đúng quyền; kiểm tra job thất bại, URL hết hạn và mất kết nối.
4. Check-in thật cập nhật đúng cổng, không đếm quét lặp; giám sát hiển thị trong chu kỳ poll kế tiếp. Kiểm tra lỗi mạng và ẩn tab.
5. Kiểm tra mobile, thao tác bàn phím, trạng thái rỗng/tải/lỗi và redirect khi chưa đăng nhập/sai vai trò.

## Chạy kiểm tra frontend

Từ thư mục gốc repo, dùng pnpm đã pin trong package.json:

```bash
pnpm --filter @tickethub/web test
pnpm --filter @tickethub/web exec tsc --noEmit
pnpm --filter @tickethub/web lint
pnpm --filter @tickethub/web test:e2e test/w05-organizer-operations.spec.ts --project=chromium --workers=1
```

Test trình duyệt cần API, web đang chạy và tài khoản BTC seed của môi trường phát triển. Test dùng đăng nhập thật, thay response API W05 bằng fixture qua Playwright route; không sửa DB hoặc tạo nhân viên thật. Với Chromium hệ thống của cloud, đặt `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/usr/bin/chromium`. Nếu chưa có server, cấu hình Playwright hiện tại chạy bản build production, vì vậy cần build trước.

Trong môi trường cloud hiện tại, build production bị chặn bởi quyền truy cập Google Fonts (`fonts.googleapis.com`, `fonts.gstatic.com`). Kiểm thử giao diện chạy với Next.js dev và phông dự phòng. Cần áp dụng quyền mạng đã đề xuất trong cài đặt môi trường rồi chạy lại `pnpm --filter @tickethub/web build`. Không đổi layout hoặc tắt xác minh TLS để né lỗi môi trường.

Đã đối chiếu backend thật: danh sách sự kiện trả 200; `/staff`, `/reports`, `/gate-monitor` trả 404. Chưa thể xác nhận tạo tài khoản, số liệu báo cáo, check-in thật hoặc tải tệp thật cho W05 cho đến khi BE2 hoàn tất hợp đồng trên. Cần FE2 review chéo theo quy định dự án trước khi merge.
