# Thiết kế Kế hoạch Hòa giải Mã nguồn - Tài liệu và Cổng Kiểm soát Hợp đồng (Code-Doc Reconciliation & Contract Gate)

- **Ngày tạo:** 01/11/2026
- **Tác giả:** Antigravity (Pair Programming cùng Project Manager)
- **Trạng thái:** Đã cập nhật theo phản hồi của PM (Pending Final Approval)

---

## 1. Bối cảnh và Mục đích (Intent & Why)

Dự án TicketHub được định hướng phát triển theo mô hình tài liệu định hướng (Documentation-driven Development). Các tài liệu trong thư mục `docs/` ([API_CONTRACT.md](file:///home/user/Downloads/Repos/ticket-hub/docs/API_CONTRACT.md), [ERD.md](file:///home/user/Downloads/Repos/ticket-hub/docs/ERD.md), [ARCHITECTURE.md](file:///home/user/Downloads/Repos/ticket-hub/docs/ARCHITECTURE.md), [DEVELOPMENT_STANDARDS.md](file:///home/user/Downloads/Repos/ticket-hub/docs/DEVELOPMENT_STANDARDS.md)) đóng vai trò là "chân lý tối thượng" (Single Source of Truth) để cộng tác viên xây dựng tính năng và để công cụ AI review thẩm định mã nguồn.

Tuy nhiên, trong thực tế phát triển phần mềm:

- Tài liệu ban đầu có thể được phác thảo trên các giả định lý thuyết, chưa bao quát hết các tình huống thực tế của framework (NestJS 12, Fastify, Next.js 16, Drizzle ORM).
- Sau nhiều chu kỳ phát triển (các đợt nâng cấp dependency, tái cấu trúc logic giữ chỗ, VNPay IPN, waiting room), mã nguồn thực tế đã có những sửa đổi cần thiết trong khi tài liệu chưa được cập nhật đồng bộ.
- Khi tài liệu bị trôi lệch (drift) hoặc chứa thông tin không chính xác, các cộng tác viên mới và AI reviewer sẽ bị dẫn dắt sai: AI từ chối code đúng chỉ vì code không khớp với tài liệu lỗi, hoặc cộng tác viên tự tạo mock/localStorage để vượt qua giao diện.

Mục đích của thiết kế này là giải quyết dứt điểm vấn đề "tài liệu ban đầu chưa chuẩn", đưa tài liệu về trạng thái phản ánh chính xác 100% hiện trạng mã nguồn đang hoạt động ổn định, đồng thời thiết lập cơ chế giám sát tự động để tài liệu không bao giờ bị trôi lệch trong tương lai.

---

## 2. Mục tiêu, Phi mục tiêu và Phản mục tiêu

### Mục tiêu (Goals)

1. **Thiết lập Mốc chân lý (Truth Baseline):** Thực hiện đợt tổng kiểm tra tự động và thủ công giữa mã nguồn đã kiểm thử ([apps/api/src/](file:///home/user/Downloads/Repos/ticket-hub/apps/api/src), [packages/shared/src/](file:///home/user/Downloads/Repos/ticket-hub/packages/shared/src)) và hệ thống tài liệu hiện tại ([docs/ERD.md](file:///home/user/Downloads/Repos/ticket-hub/docs/ERD.md), [docs/API_CONTRACT.md](file:///home/user/Downloads/Repos/ticket-hub/docs/API_CONTRACT.md)).
2. **Đồng bộ hóa tài liệu toàn diện:** Cập nhật các bảng dữ liệu, quan hệ khóa ngoại, trường thuộc tính trong [docs/ERD.md](file:///home/user/Downloads/Repos/ticket-hub/docs/ERD.md) khớp chính xác với Drizzle schema; chuẩn hóa các endpoint, tham số truy vấn, headers và cấu trúc payload trong [docs/API_CONTRACT.md](file:///home/user/Downloads/Repos/ticket-hub/docs/API_CONTRACT.md) khớp với các NestJS Controllers.
3. **Bảo toàn ngữ cảnh nghiệp vụ cấp cao:** Giữ nguyên các phần phân tích nghiệp vụ chuyên sâu (luồng phân bổ ghế tự động, cơ chế khóa hàng PostgreSQL, Transactional Outbox pattern, thuật toán chữ ký VNPay) trong tài liệu, không biến tài liệu thành bản sao thô của code.
4. **Cổng phát hiện trôi lệch tự động (Doc Drift Detection):** Xây dựng công cụ kiểm tra tự động `scripts/check-contract-drift.mjs` tích hợp vào CI/PR Gate để cảnh báo hoặc chặn các PR thay đổi schema database hoặc API controller mà quên cập nhật tài liệu tương ứng.

### Phi mục tiêu (Non-goals)

- Không viết lại toàn bộ mã nguồn của dự án (mã nguồn hiện tại đã vượt qua 120 bài kiểm thử và được xem là cơ sở thực tế đáng tin cậy).
- Không tự động hóa 100% việc sinh tài liệu bằng Swagger thuần túy (Swagger chỉ sinh schema thô, làm mất đi các hướng dẫn nghiệp vụ và giải thích kiến trúc).

### Phản mục tiêu (Anti-goals)

- Tránh việc chỉnh sửa tài liệu qua loa mà không kiểm chứng mã nguồn thực tế.
- Tránh việc để tồn tại hai phiên bản hợp đồng (một hợp đồng trong đầu lập trình viên và một hợp đồng trên tài liệu).

---

## 3. Ràng buộc kỹ thuật (Constraints)

- Tuân thủ quy tắc không dùng emoji và không dùng dấu gạch ngang dài (em-dash) trong toàn bộ tài liệu và commit message theo [CONTRIBUTING.md](file:///home/user/Downloads/Repos/ticket-hub/CONTRIBUTING.md).
- Toàn bộ nội dung cập nhật sử dụng tiếng Việt có dấu chuẩn xác.
- Mã nguồn kiểm tra tự động sử dụng Node.js thuần (ESM), không cài thêm các dependency cồng kềnh ngoài monorepo.
- Mọi điều chỉnh tài liệu phải tương thích với các Zod Schemas trong package [@tickethub/shared](file:///home/user/Downloads/Repos/ticket-hub/packages/shared).

---

## 4. Các phương án tiếp cận (Approaches)

### Phương án 1: Hòa giải Mã nguồn - Tài liệu và Cổng Hợp đồng Tự động (Được chọn)

- **Cơ chế:** Lấy mã nguồn thực tế đã được kiểm thử làm mốc chân lý ban đầu để đồng bộ hóa toàn diện tài liệu `docs/`. Sau đó thiết lập script đối soát tự động giữa code và tài liệu chạy trong CI.
- **Đánh đổi:** Cần một đợt rà soát ban đầu cẩn trọng, nhưng giải quyết dứt điểm nợ kỹ thuật và bảo vệ tính toàn vẹn lâu dài của tài liệu.

### Phương án 2: Chuyển đổi sang Mô hình Code-First Generation

- **Cơ chế:** Coi code là chân lý duy nhất và dùng công cụ (OpenAPI/Swagger, Drizzle ERD generator) để sinh tự động tài liệu Markdown.
- **Đánh đổi:** Nhanh chóng nhưng làm mất toàn bộ ngữ cảnh phân tích nghiệp vụ chuyên sâu, các ca biên (edge cases) và quy định kiến trúc quan trọng trong `docs/`.

### Phương án 3: Cập nhật Từng phần theo Yêu cầu (On-demand RFC)

- **Cơ chế:** Chỉ sửa tài liệu khi một tính năng cụ thể gặp vấn đề trong quá trình làm.
- **Đánh đổi:** Không tốn công sức làm một đợt tổng rà soát ngay, nhưng khiến tài liệu bị chắp vá, các PR tiếp tục gặp lỗi lệch hợp đồng và làm chậm tiến độ chung.

**Lựa chọn:** Phương án 1 được chọn vì TicketHub đã có mã nguồn chạy tốt, cần một nền tảng tài liệu chính xác tuyệt đối để phục vụ cho các cộng tác viên và AI agent.

---

## 5. Chi tiết các giai đoạn triển khai (Implementation Phases)

### Giai đoạn 1: Công cụ Đối soát Ngữ nghĩa Tự động (Semantic Audit Tooling)

Xây dựng script `scripts/audit-doc-parity.mjs` (chạy qua lệnh `pnpm docs:check`) có khả năng:

1. **Kiểm tra Database Schema vs ERD.md:**
   - Đọc danh sách bảng và cột từ [apps/api/src/database/schema/](file:///home/user/Downloads/Repos/ticket-hub/apps/api/src/database/schema/).
   - Quét [docs/ERD.md](file:///home/user/Downloads/Repos/ticket-hub/docs/ERD.md) để đối chiếu: tên bảng, các cột bắt buộc, kiểu dữ liệu, các quan hệ khóa ngoại (foreign keys).
   - Xử lý các bảng tương lai: Nếu bảng hoặc cột được gắn nhãn `[PLANNED]` hoặc `[Dự kiến]`, công cụ sẽ ghi nhận là tính năng nằm trong kế hoạch và không báo lỗi thiếu mã nguồn.
   - Xuất danh sách bảng/cột thực tế bị thiếu hoặc lệch kiểu dữ liệu so với tài liệu.
2. **Kiểm tra API Controllers vs API_CONTRACT.md:**
   - Quét tất cả các decorator `@Controller`, `@Get`, `@Post`, `@Put`, `@Patch`, `@Delete` trong [apps/api/src/](file:///home/user/Downloads/Repos/ticket-hub/apps/api/src/).
   - Đối chiếu với bảng danh sách endpoint trong [docs/API_CONTRACT.md](file:///home/user/Downloads/Repos/ticket-hub/docs/API_CONTRACT.md).
   - Xử lý các endpoint tương lai: Nếu endpoint được gắn nhãn `[PLANNED]` hoặc `[Dự kiến]`, công cụ bỏ qua không báo lỗi thiếu controller.
   - Xuất danh sách endpoint có trong code nhưng thiếu trong doc, hoặc có trong doc nhưng chưa được code triển khai mà không có nhãn kế hoạch.

### Giai đoạn 2: Chuẩn hóa Toàn bộ Tài liệu (Documentation Alignment)

1. **Cập nhật [docs/ERD.md](file:///home/user/Downloads/Repos/ticket-hub/docs/ERD.md):**
   - Bổ sung và đồng bộ hóa chính xác cấu trúc của 17 bảng dữ liệu (users, events, seats, tickets, orders, order_items, transactions, ticket_types, organizer_profiles, event_staff, gates, outbox, idempotency_keys, refunds, payouts, audit_log, ...).
   - Gắn nhãn `[PLANNED]` cho các bảng tương lai chưa tạo trong database (ví dụ: venues, venue_layouts).
   - Đảm bảo sơ đồ Mermaid ERD và bảng chi tiết cột phản ánh đúng các trường kiểu dữ liệu (UUID, text, integer, timestamp, jsonb).
2. **Cập nhật [docs/API_CONTRACT.md](file:///home/user/Downloads/Repos/ticket-hub/docs/API_CONTRACT.md):**
   - Rà soát toàn bộ các nhóm route: `/auth`, `/events`, `/venues`, `/waiting-room`, `/booking`, `/checkout`, `/tickets`, `/refund`, `/admin`, `/uploads`.
   - Gắn nhãn `[PLANNED]` cho các endpoint thuộc tính năng tương lai chưa triển khai code backend.
   - Đảm bảo format request/response khớp với Zod schemas trong [packages/shared/src/schemas/](file:///home/user/Downloads/Repos/ticket-hub/packages/shared/src/schemas/).
   - Bổ sung rõ các header bảo mật bắt buộc (`Authorization`, `x-admission-token`, `x-idempotency-key`).
3. **Cập nhật [docs/ARCHITECTURE.md](file:///home/user/Downloads/Repos/ticket-hub/docs/ARCHITECTURE.md):**
   - Làm rõ cơ chế giữ chỗ nguyên tử với PostgreSQL `SELECT ... FOR UPDATE` theo thứ tự `id ASC`.
   - Đặc tả rõ mô hình Transactional Outbox pattern cho tác vụ gửi email vé phi đồng bộ.

### Giai đoạn 3: Tích hợp Cổng Cảnh báo Trôi lệch Mềm (Doc Drift Soft Warning Gate)

1. Thêm lệnh kiểm tra vào `package.json`:
   ```bash
   pnpm docs:check
   ```
2. Tích hợp cơ chế cảnh báo vào PR Gate workflow:
   - Khi một PR có thay đổi trong `apps/api/src/database/schema/` hoặc `apps/api/src/**/*.controller.ts`, bot chạy `pnpm docs:check`.
   - Nếu phát hiện độ lệch mà PR không cập nhật tài liệu tương ứng:
     - Bot gắn nhãn `needs-doc-update`.
     - Bot đăng bình luận cảnh báo mềm (Soft Warning) liệt kê danh sách endpoint hoặc bảng bị lệch để nhắc nhở tác giả và reviewer.
     - Không hủy tiến trình CI, cho phép merge các trường hợp hotfix khẩn cấp mà không làm nghẽn pipeline.

---

## 6. Phần việc dành cho người triển khai (What's Left to the Builder)

- Viết parser đọc AST TypeScript hoặc regex phân tích routes và Drizzle schema trong script đối soát `scripts/audit-doc-parity.mjs`.
- Bổ sung các test cases kiểm tra parser để đảm bảo không bỏ sót endpoint.
- Cập nhật chi tiết nội dung văn bản trong các file Markdown thuộc `docs/`.
