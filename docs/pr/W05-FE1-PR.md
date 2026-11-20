## 1. Loại thay đổi (PR Type)

- [x] `feat`: Tính năng mới
- [x] `fix`: Sửa lỗi hệ thống
- [x] `docs`: Cập nhật tài liệu
- [ ] `refactor`: Tái cấu trúc mã nguồn (không thay đổi hành vi)
- [ ] `chore`: Cấu hình công cụ, nâng cấp thư viện, tác vụ bảo trì

Hoàn thiện W05-FE1: quản lý nhân viên/cổng, báo cáo doanh thu theo bộ lọc, xuất CSV/Excel nền và giám sát cổng cho Ban tổ chức. Adapter dùng hợp đồng thực tế của BE2 tại PR #49, head `ff96dd3`.

## 2. Kiểm tra kỹ thuật trước khi gửi (Pre-flight Checks)

- [x] Đã chạy `pnpm typecheck` và không có lỗi TypeScript
- [x] Đã chạy `pnpm lint` và không có lỗi vi phạm quy tắc lint
- [x] Đã chạy `pnpm format:check` và mã nguồn đã được định dạng nhất quán
- [x] Đã chạy `pnpm test` và tất cả các bài kiểm thử đều vượt qua (PASS)

Kết quả `pnpm test`: 481 test đạt, gồm API 387, web 74 và shared 20; không có test lỗi, hủy hoặc bỏ qua. API tests sử dụng DB test riêng và Redis riêng.

`pnpm build` đã chạy: shared và API đạt, web bị chặn khi tải Inter/JetBrains Mono từ Google Fonts do chính sách mạng môi trường cloud. Chưa xác nhận build production thành công. Cần mở `fonts.googleapis.com`, `fonts.gstatic.com` và chạy lại build trước khi merge; không thay layout, checksum hoặc tắt TLS để né lỗi.

## 3. Cam kết chất lượng mã nguồn (Code Quality Guarantees)

- [x] Không chứa mã giả lập ở client (không dùng localStorage hoặc mock để thay thế API backend)
- [x] Không sử dụng kiểu `any` (dùng schema Zod hoặc kiểu `unknown` có kiểm tra kiểu)
- [x] Tuân thủ token màu tại `docs/DESIGN_TOKENS.md` (không dùng mã hex thô không khai báo)
- [x] Không chứa biểu tượng cảm xúc (emoji) trong commit message và nội dung trao đổi
- [x] Không chứa ký tự gạch ngang dài (em-dash) trong commit message và nội dung
- [x] Không can thiệp trái phép vào hạ tầng kiểm soát (không sửa đổi .github/workflows/, scripts/pr-gate-_, scripts/audit-doc-_, tests/pr-gate-*)

Các fixture API/phiên đăng nhập chỉ nằm trong Playwright tests và config test độc lập. Không thêm mock vào ứng dụng hoặc bỏ route guard. SessionProvider hiện có vẫn được tái sử dụng; không lưu dữ liệu nghiệp vụ giả vào localStorage. Các commit của nhánh tuân thủ Conventional Commits. Nhánh đã đối chiếu và chứa `newtab64/unstable` mới nhất tại thời điểm gửi.

## 4. Danh sách ca kiểm thử (Test Cases)

- Quản lý nhân viên: tạo tài khoản riêng với phân công; gán cổng bằng userId, bỏ phân công, xác nhận khóa/mở khóa và lỗi email trùng.
- Phân trang: giữ meta ngoài data, đọc hết các trang cổng/phân công, chuyển trang tài khoản và tìm kiếm trên trang hiện tại.
- Báo cáo: gửi đúng fromDate/toDate/ticketTypeId/voucherCode, xử lý tiền SQL dạng chuỗi, timestamp PostgreSQL/ISO và doanh thu sau hoàn âm. Không diễn giải sales.paid_revenue thành doanh thu sau hoàn.
- Xuất file: PENDING/PROCESSING/COMPLETED/FAILED/EXPIRED, lịch sử sau F5, tải bằng Bearer token, refresh đúng một lần khi 401 và xử lý 410.
- Giám sát: số vé khác số lượt quét, hiển thị cả lượt bị từ chối, tự cập nhật theo chu kỳ, tạm dừng, lỗi mạng giữ snapshot kèm cảnh báo và phân trang lịch sử.
- Giao diện: viewport mobile 390px không tràn ngang, dữ liệu rỗng, API chưa hỗ trợ và redirect khi chưa đăng nhập.
- Bộ Playwright frontend độc lập: 10/10 đạt, không cần backend/DB/worker.
- Bộ tích hợp thật với mã PR #49, DB riêng và report worker: 2/2 đạt; tạo nhân viên/cổng, phân công, khóa tài khoản, xem báo cáo/giám sát, xuất và tải CSV/XLSX thật. Tệp XLSX được kiểm tra chữ ký ZIP, không dùng response fixture cho suite này.
- Kiểm tra đồng bộ tài liệu: `node scripts/audit-doc-parity.mjs` đạt.

## 5. Ghi chú bổ sung (Additional Notes)

- Base PR: `newtab64/tickethub:unstable`. Head: `vikietduong/tickethub:feat/w05-fe1-web-operations`.
- Chỉ thay đổi frontend, test frontend và tài liệu/ảnh minh chứng. Không merge hoặc sửa backend PR #49, không thêm migration, không thay dependency/lockfile hoặc hạ tầng kiểm soát.
- API W05 chỉ cho ORGANIZER theo backend PR #49. Khóa nhân viên áp dụng toàn tài khoản; tải báo cáo gọi endpoint có xác thực, không đưa token vào URL.
- Nhánh FE chưa bao gồm module backend W05. Để nghiệm thu tích hợp cần dùng backend PR #49 và report worker với cùng DATABASE_URL/REPORT_EXPORT_DIR. Không tự tính doanh thu bằng inventory công khai.
- Báo cáo có thể trễ khoảng 6 phút do MV/cache. Phí nền tảng/cổng và số tiền chi trả chưa được backend cấu hình; UI không biến null thành số 0.
- Hướng dẫn chạy đầy đủ: [W05-FE1-API-HANDOFF.md](https://github.com/vikietduong/tickethub/blob/feat/w05-fe1-web-operations/docs/W05-FE1-API-HANDOFF.md).
- Cần FE2 review chéo; chưa tự merge hoặc xác nhận quyền merge. Giữ PR ở trạng thái draft cho đến khi build production và các kiểm tra GitHub hoàn tất.

## 6. Minh chứng trực quan (Visual Evidence)

Ảnh chụp trực tiếp từ Chromium chạy Next.js dev với fixture Playwright của API PR #49. Đây là dữ liệu kiểm thử, không phải doanh thu hoặc tài khoản production. Các nút DevTools được ẩn khỏi ảnh; không chỉnh sửa nội dung giao diện hoặc số liệu sau khi chụp. Bộ tích hợp backend thật được kiểm tra riêng như Mục 4.

Quản lý nhân viên và phân công cổng:

![W05 FE1 quản lý nhân viên](https://raw.githubusercontent.com/vikietduong/tickethub/feat/w05-fe1-web-operations/docs/evidence/w05-fe1/staff-management.png)

Báo cáo doanh thu, bộ lọc, biểu đồ, hạng vé và lịch sử xuất tệp:

![W05 FE1 báo cáo doanh thu](https://raw.githubusercontent.com/vikietduong/tickethub/feat/w05-fe1-web-operations/docs/evidence/w05-fe1/revenue-dashboard.png)

Giám sát cổng và lịch sử lượt quét bị từ chối:

![W05 FE1 giám sát cổng](https://raw.githubusercontent.com/vikietduong/tickethub/feat/w05-fe1-web-operations/docs/evidence/w05-fe1/gate-monitor.png)
