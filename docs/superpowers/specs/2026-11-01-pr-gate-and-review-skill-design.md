# Thiết kế Cổng kiểm soát Pull Request (PR Strict Gate) và Kỹ năng AI Review cho Quản lý dự án

- **Ngày tạo:** 01/11/2026
- **Tác giả:** Antigravity (Pair Programming cùng Project Manager)
- **Trạng thái:** Đã cập nhật theo phản hồi của PM (Pending Final Approval)

---

## 1. Bối cảnh và Mục đích (Intent & Why)

Dự án TicketHub là hệ thống bán vé sự kiện quy mô lớn, đòi hỏi tính toàn vẹn dữ liệu, kiểm soát tranh chấp ghế nghiêm ngặt và trải nghiệm người dùng chuẩn mực. Trong quá trình phát triển, các Pull Request từ cộng tác viên thường gặp phải các vấn đề nghiêm trọng:

- Vi phạm hợp đồng kiến trúc (ví dụ: tự giả lập dữ liệu/token ở client-side bằng `localStorage`, gọi nhầm cổng API).
- Bỏ qua các ràng buộc thiết kế (dùng màu hex tự do thay vì `DESIGN_TOKENS.md`, thêm component thừa thãi như minimap/legend phá vỡ giao diện).
- Thiếu kiểm thử thực tế nhưng vẫn đánh dấu hoàn thành trong báo cáo.

Để bảo vệ nhánh `unstable` và chuẩn hóa quy trình đóng góp như các dự án mã nguồn mở lớn, hệ thống cần:

1. Một **cổng kiểm soát tự động cấp thấp (PR Gate)** từ chối ngay lập tức các PR không hoàn thành checklist hoặc vi phạm quy tắc cơ bản.
2. Một **kỹ năng AI chuyên sâu (`pr-reviewer`)** hỗ trợ Quản lý dự án (Project Manager) bóc tách chi tiết chất lượng mã nguồn, cảnh báo "mã rác/giả lập" (trash code) và đưa ra quyết định duyệt/từ chối chính xác.

---

## 2. Mục tiêu, Phi mục tiêu và Phản mục tiêu

### Mục tiêu (Goals)

- Bắt buộc mọi PR phải tuân thủ cấu trúc mẫu kiểm tra ([.github/pull_request_template.md](file:///home/user/Downloads/Repos/ticket-hub/.github/pull_request_template.md)).
- Tự động đóng (auto-reject) và phản hồi lý do cụ thể qua GitHub Actions workflow nếu PR chưa đánh dấu đủ các mục kiểm tra bắt buộc hoặc chứa commit message có emoji/ký tự cấm.
- Cung cấp skill AI `.agents/skills/pr-reviewer/SKILL.md` để PM có thể kích hoạt bất cứ lúc nào:
  - Tự động kiểm tra git diff giữa nhánh PR và `unstable`.
  - Đối chiếu với các tài liệu dự án: `DEVELOPMENT_STANDARDS.md`, `API_CONTRACT.md`, `DESIGN_TOKENS.md`, `CONTRIBUTING.md`.
  - Phát hiện "trash code": client mock, token giả lập, hardcoded hex, `any` casts, biến không sử dụng.
  - Chạy bộ kiểm tra tĩnh: `pnpm format:check`, `pnpm typecheck`, `pnpm lint`.
  - Xuất báo cáo định dạng chuẩn markdown kèm trích dẫn dòng code vi phạm cụ thể và khuyến nghị rõ ràng (Approve / Request Changes / Reject).

### Phi mục tiêu (Non-goals)

- Không tự động sinh code thay thế cho cộng tác viên trong quy trình review này (chỉ chỉ ra lỗi và đề xuất cách sửa).
- Không tự động merge PR khi đạt điểm tối đa (quyền merge thuộc về Admin duy nhất theo `CONTRIBUTING.md`).

### Phản mục tiêu (Anti-goals)

- Tránh việc AI review quá dễ dãi hoặc "khen ngợi ngoại giao" khi mã nguồn chứa vi phạm kỹ thuật.
- Tránh việc để lọt các đoạn code giả lập (mocking) vào nhánh chính dưới vỏ bọc "tính năng đã hoàn thành".

---

## 3. Ràng buộc kỹ thuật (Constraints)

- Tuân thủ quy tắc không dùng emoji và không dùng dấu gạch ngang dài (em-dash) trong commit message, tài liệu và báo cáo theo `CONTRIBUTING.md`.
- Workflow GitHub Actions phải chạy nhanh (dưới 30 giây cho bước gate check), không tiêu tốn tài nguyên build nặng cho các PR chưa đạt điều kiện cơ bản.
- AI Skill phải tương thích với cấu trúc `.agents/skills/<name>/SKILL.md` của kho lưu trữ TicketHub.

---

## 4. Các phương án tiếp cận (Approaches)

### Phương án 1: Mô hình hai lớp (Được chọn)

- **Lớp 1 (GitHub PR Template + PR Gate Workflow)**: Tự động kiểm tra checklist và quy chuẩn commit ngay khi PR được mở/sửa. Nếu không đạt, workflow dùng GitHub Script / gh cli đóng PR ngay lập tức kèm comment hướng dẫn.
- **Lớp 2 (AI Skill dành cho PM)**: Được kích hoạt theo yêu cầu của PM để đánh giá sâu mã nguồn của PR đã qua cổng sơ loại.
- **Đánh đổi**: Cần thêm một file workflow `.github/workflows/pr-gate.yml` và cấp quyền `pull-requests: write` cho token GITHUB_TOKEN, nhưng ngăn ngừa lãng phí tài nguyên và công sức review của PM.

### Phương án 2: Toàn bộ kiểm soát nằm trong AI Skill

- Không có workflow tự động đóng PR. Khi PM yêu cầu AI review PR, AI sẽ đọc checklist, nếu thiếu thì tự gọi lệnh `gh pr close`.
- **Đánh đổi**: Đơn giản hơn về mặt CI, nhưng PM vẫn phải mất thời gian kích hoạt và đợi AI kiểm tra từng PR rác thay vì để hạ tầng tự động xử lý.

**Lựa chọn:** Phương án 1 vì tính tự động hóa cao và phù hợp với tiêu chuẩn dự án lớn.

---

## 5. Chi tiết thiết kế các thành phần

### Thành phần 1: PR Checklist Template (`.github/pull_request_template.md`)

Bao gồm các mục bắt buộc:

1. Phân loại thay đổi (feat, fix, refactor, docs, chore).
2. Tự kiểm tra kỹ thuật (Đã chạy `pnpm typecheck`, `pnpm lint`, `pnpm format:check`, `pnpm test`).
3. Cam kết chất lượng mã nguồn:
   - Không chứa mã giả lập ở client (mock/localStorage thay thế cho API backend).
   - Không chứa kiểu `any` (sử dụng schema Zod hoặc `unknown`).
   - Tuân thủ token màu trong `DESIGN_TOKENS.md` (không dùng màu hex thô không khai báo).
   - Không chứa emoji trong commit message và nội dung trao đổi.
4. Danh sách các ca kiểm thử (Test cases) đã thực hiện và kết quả.

### Thành phần 2: PR Gate Workflow (`.github/workflows/pr-gate.yml`)

- **Trigger**: `pull_request_target: [opened, edited, synchronize, reopened]` trỏ đích về `unstable` hoặc `stable`. Sự kiện `pull_request_target` đảm bảo quyền ghi token an toàn cho cả nhánh nội bộ và các bản fork của contributor mà không checkout mã không tin cậy.
- **Nhiệm vụ**:
  - Quét nội dung body của PR: kiểm tra xem toàn bộ các checkbox bắt buộc `[x]` đã được đánh dấu hay chưa.
  - Quét tiêu đề PR và danh sách commit message: đảm bảo tuân thủ Conventional Commits và không chứa emoji.
  - Khi vi phạm:
    - Gắn nhãn `needs-checklist` hoặc `invalid-commit`.
    - Hủy các workflow CI nặng (`ci.yml`) đang chạy đồng thời trên PR để tiết kiệm tài nguyên hệ thống.
    - Đăng comment hướng dẫn contributor cách sửa và tự động đóng PR (`state: closed`).
  - Chu kỳ phục hồi (Contributor Recovery Lifecycle):
    - Khi tác giả chỉnh sửa PR description để tích đủ checklist hoặc sửa commit, workflow kích hoạt qua event `edited` hoặc `reopened`.
    - Nếu toàn bộ điều kiện đã đạt: bot tự động gỡ nhãn lỗi, đăng comment xác nhận hợp lệ và tự động mở lại PR (`state: open`).

### Thành phần 3: Kỹ năng AI Review (`.agents/skills/pr-reviewer/SKILL.md`)

- **Tên**: `pr-reviewer`
- **Mô tả**: Hỗ trợ Project Manager đánh giá chi tiết Pull Request, phát hiện lỗi vi phạm tiêu chuẩn và cảnh báo mã kém chất lượng.
- **Phạm vi tương tác (PM Advisory)**:
  - Mặc định xuất báo cáo đánh giá 4 phần định dạng markdown artifact cho PM xem và quyết định trong môi trường cục bộ.
  - Chỉ khi PM phê duyệt và yêu cầu đăng công khai lên GitHub, AI mới hỗ trợ gọi lệnh `gh pr review` (đảm bảo tuân thủ quy tắc không dùng emoji và không dùng dấu gạch ngang dài trong comment).
- **Quy trình thực thi**:
  1. Lấy thông tin PR qua `gh pr diff <number>` và metadata qua `gh pr view`.
  2. Quét tĩnh các lỗi cấm: tìm kiếm `any`, tìm kiếm các chuỗi mock (`localStorage`, `sessionStorage` tự sinh token, `setTimeout` giả vờ gọi API), tìm kiếm màu hex tùy tiện (`#[0-9a-fA-F]{6}`).
  3. Kiểm tra tính tương thích API: đối chiếu endpoint với `API_CONTRACT.md` và `apps/api/src/`.
  4. Chạy kiểm tra kỹ thuật trên nhánh PR: typecheck, lint, format.
  5. Xuất báo cáo cấu trúc 4 phần:
     - **Tóm tắt & Phán quyết**: `APPROVE`, `REQUEST_CHANGES`, hoặc `REJECT (TRASH_CODE)`.
     - **Lỗi nghiêm trọng (Blockers)**: Các vi phạm hợp đồng hoặc mã giả mạo.
     - **Cảnh báo chất lượng mã (Trash Code / Code Smell)**: Hex colors, anti-patterns, nợ kỹ thuật.
     - **Khuyến nghị & Hành động**: Các bước sửa cụ thể kèm file và dòng code.

---

## 6. Phần việc dành cho người triển khai (What's Left to the Builder)

- Định nghĩa chính xác cú pháp các thẻ markdown trong `pull_request_template.md` để GitHub Actions regex dễ dàng nhận diện.
- Viết action step trong `pr-gate.yml` sử dụng `@actions/github` script hoặc bash/gh cli.
- Viết file `SKILL.md` chi tiết với các checklist quét lỗi và mẫu báo cáo markdown tối ưu.
