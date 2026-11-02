# Thiết kế Cổng kiểm soát Minh chứng Trực quan và Chống Gian lận PR Gate

- **Tài liệu:** Thiết kế kỹ thuật nâng cấp PR Strict Gate
- **Ngày lập:** 2026-11-01
- **Trạng thái:** Chờ phê duyệt (Pending Review)

---

## 1. Mục tiêu và Bối cảnh (Intent & Why)

### 1.1. Bối cảnh

Quản lý dự án (PM) và các Reviewer phải xử lý số lượng lớn Pull Request (PR) từ các cộng tác viên. Hiện tại:

- Khi một PR thay đổi giao diện (`apps/web`), reviewer phải mất nhiều thời gian kiểm tra hoặc khởi chạy môi trường cục bộ để xem giao diện có bị vỡ, lệch layout hay không.
- Có nguy cơ cộng tác viên cố tình sửa đổi kịch bản kiểm tra gate (`scripts/pr-gate-check.mjs`), sửa đổi bộ unit test của gate (`tests/pr-gate-check.test.mjs`), hạ thấp ngưỡng kiểm tra trong GitHub workflow hoặc tự ý sửa đổi tài liệu kiến trúc cốt lõi (`docs/`) nhằm qua mặt quy trình kiểm duyệt chất lượng.

### 1.2. Mục tiêu cốt lõi

1. **Giảm tải cho Quản lý dự án (Reduce PM Workload):** Tự động bắt buộc đính kèm minh chứng hình ảnh hoặc video khi PR có thay đổi giao diện người dùng hiển thị trực quan.
2. **Bảo vệ hạ tầng kiểm soát (Anti-Tampering Protection):** Ngăn chặn 100% các PR từ người đóng góp thông thường tự ý sửa đổi kịch bản kiểm tra gate, workflow CI/CD và bộ unit test kiểm định của gate.
3. **Bảo vệ tài liệu kiến trúc (Doc Guard):** Đảm bảo việc sửa đổi tài liệu kiến trúc phải được khai báo đúng loại PR và không làm sai lệch hợp đồng API / ERD.

---

## 2. Các phương án kiến trúc đã xem xét (Approaches Considered)

1. **Phương án 1 (Được chọn): Tự động phát hiện tệp thay đổi và cưỡng chế kiểm tra tại PR Gate Engine**
   - Đọc danh sách tệp thay đổi (changed files) từ GitHub PR payload.
   - Nếu có tệp UI (`apps/web/src/**`), bắt buộc có link ảnh Markdown hoặc link video trong mục `## 6. Minh chứng trực quan`.
   - Nếu phát hiện tệp thuộc hạ tầng kiểm soát (`.github/workflows/**`, `scripts/pr-gate-*`, `scripts/audit-doc-*`, `tests/pr-gate-*`, `tests/audit-doc-*`), tự động chặn PR (hard block) trừ khi có nhãn bypass của Maintainer.
   - Ưu điểm: Tự động, chặt chẽ, loại bỏ hoàn toàn khả năng gian lận.

2. **Phương án 2 (Bị loại bỏ): Chỉ dùng Checklist cam kết bằng tay**
   - Chỉ thêm checkbox cam kết vào template.
   - Nhược điểm: Dễ bị qua mặt bằng việc tick bừa (fake compliance), không giảm được tải công việc thực tế cho PM.

---

## 3. Quy chuẩn kỹ thuật chi tiết (Detailed Specifications)

### 3.1. Cập nhật biểu mẫu Pull Request Template (`.github/pull_request_template.md`)

Bổ sung thêm 2 mục bắt buộc:

1. **Cam kết không can thiệp hạ tầng kiểm soát (Anti-Tampering Commitment):**
   ```markdown
   - [ ] Không can thiệp trái phép vào hạ tầng kiểm soát (không sửa đổi .github/workflows/, scripts/pr-gate-_, scripts/audit-doc-_, tests/pr-gate-*)
   ```
2. **Mục Minh chứng trực quan (Visual Evidence):**
   ```markdown
   ## 6. Minh chứng trực quan (Visual Evidence)

   Bắt buộc đính kèm ít nhất 1 hình ảnh hoặc video minh chứng nếu PR có thay đổi giao diện người dùng (UI/UX) tại `apps/web`:

   <!-- Dán ảnh chụp màn hình hoặc liên kết video (Loom, YouTube, Drive) tại đây -->
   <!-- Ví dụ: ![Ảnh màn hình](https://...) hoặc Video: https://... -->
   <!-- Nếu PR chỉ sửa Backend/Logic không có giao diện, ghi rõ: N/A - Không có thay đổi giao diện -->
   ```

### 3.2. Cập nhật Kịch bản Kiểm tra Gate (`scripts/pr-gate-check.mjs`)

Hàm `validatePullRequest` nhận thêm tham số `changedFiles: string[]`:

1. **Quy tắc Anti-Tampering (Chống sửa lén kịch bản):**
   - Danh sách tệp được bảo vệ nghiêm ngặt:
     - `.github/workflows/ci.yml`
     - `.github/workflows/pr-gate.yml`
     - `scripts/pr-gate-check.mjs`
     - `scripts/audit-doc-parity.mjs`
     - `tests/pr-gate-check.test.mjs`
     - `tests/audit-doc-parity.test.mjs`
   - Nếu `changedFiles` chứa bất kỳ tệp nào trong danh sách trên:
     - Báo lỗi: `Phát hiện sửa đổi tệp hạ tầng kiểm soát bị cấm: "<filePath>". Người đóng góp không được phép tự ý thay đổi kịch bản kiểm tra gate hoặc workflow CI.`
     - Gắn cờ vi phạm bảo mật (Security Blocker).

2. **Quy tắc Visual Evidence (Bắt buộc minh chứng giao diện):**
   - Danh sách phần mở rộng giao diện trực quan: `.tsx`, `.jsx`, `.css`, `.module.css` nằm trong `apps/web/src/`.
   - Ngoại lệ (không tính là visual UI):
     - `apps/web/src/lib/**` (tiện ích logic thuần)
     - `apps/web/test/**` (bộ test)
     - `apps/web/src/proxy.ts`, `apps/web/src/app/api/**` (API routes)
   - Nếu PR có thay đổi tệp giao diện hiển thị:
     - Kiểm tra nội dung mục `## 6. Minh chứng trực quan`:
     - Nếu chứa chuỗi `N/A` hoặc `Không có thay đổi giao diện` nhưng thực tế lại sửa tệp component/page UI: Báo lỗi gian lận khai báo.
     - Kiểm tra sự hiện diện của định dạng hình ảnh/video:
       - Cú pháp Markdown ảnh: `!\[.*?\]\(.+?\)` hoặc `<img\s+[^>]*src=["'].+?["']`
       - Hoặc URL media: `(https?:\/\/[^\s]+(?:\.(?:png|jpg|jpeg|gif|webp|mp4|webm)|loom\.com\/share\/|youtube\.com\/|youtu\.be\/|drive\.google\.com\/))`
     - Nếu không tìm thấy: Báo lỗi `PR có thay đổi giao diện tại apps/web nhưng chưa đính kèm ảnh chụp màn hình hoặc video minh chứng tại Mục 6.` và gắn nhãn `needs-visual-proof`.

3. **Quy tắc Kiểm tra Cam kết:**
   - Kiểm tra ô checkbox cam kết không can thiệp hạ tầng kiểm soát phải được tích chọn `[x]`.

### 3.3. Tích hợp trong GitHub Actions (`.github/workflows/pr-gate.yml`)

- Lấy danh sách `changedFiles` thông qua GitHub API (`github.rest.pulls.listFiles`).
- Truyền danh sách tệp vào hàm `validatePullRequest({ title, body, commits, changedFiles, docParity })`.
- Tự động quản lý nhãn `needs-visual-proof` và `security-violation` khi phát hiện vi phạm.

### 3.4. Nâng cấp Toàn diện Kỹ năng AI PR Reviewer (`.agents/skills/pr-reviewer/SKILL.md`)

Kỹ năng `pr-reviewer` được nâng cấp để hiểu sâu bối cảnh nghiệp vụ, phân tích chính xác hành động của contributor và chỉ rõ điều gì sai kèm lý do kỹ thuật:

1. **Hiểu rõ Bối cảnh (Context Awareness):**
   - Tự động trích xuất Use Case tương ứng từ tiêu đề/mô tả PR (ví dụ: UC01 Auth, UC04 Seat Hold, UC07 Create Event...).
   - Đối chiếu với tài liệu quy chuẩn liên quan: [docs/ARCHITECTURE.md](file:///home/user/Downloads/Repos/ticket-hub/docs/ARCHITECTURE.md), [docs/API_CONTRACT.md](file:///home/user/Downloads/Repos/ticket-hub/docs/API_CONTRACT.md), [docs/ERD.md](file:///home/user/Downloads/Repos/ticket-hub/docs/ERD.md), và [docs/DESIGN_TOKENS.md](file:///home/user/Downloads/Repos/ticket-hub/docs/DESIGN_TOKENS.md).
   - Đọc toàn bộ chuỗi commit để hiểu ý đồ kiến trúc và tiến trình xử lý của contributor.

2. **Phân tích Rõ ràng Người đóng góp Đã làm gì (What the Contributor Did):**
   - Bóc tách luồng dữ liệu (Data Flow): Từ UI Component -> Next.js Route/Proxy -> NestJS Controller -> Database/Redis.
   - Liệt kê các thành phần mới được tạo ra, các chức năng đã hoàn thiện đạt yêu cầu.

3. **Chẩn đoán Chuyên sâu Điều gì Sai và Tại sao Sai (What's Wrong & Technical Impact):**
   - Đối chiếu phạm vi (Scope Boundary): Nhận diện mã thừa, mã ngoài phạm vi (out-of-scope), hoặc tính năng chưa được duyệt.
   - Bẫy logic và rủi ro vận hành: Race condition, rò rỉ bộ nhớ, stale state, bất đồng bộ không kiểm soát, thiếu cleanup khi component unmount.
   - Vi phạm quy chuẩn & gian lận: Thiếu ảnh/video minh chứng khi sửa UI, sửa đổi tệp kiểm soát (`scripts/pr-gate-*`, `.github/workflows/*`), hardcode màu sắc, dùng kiểu `any`.
   - Bắt buộc nêu rõ: `Tệp:Dòng code`, `Hành vi hiện tại`, `Hành vi đúng chuẩn`, và `Hậu quả nếu đưa vào production`.

4. **Khuyến nghị Định hướng Kỹ thuật (Actionable Guidance - Không cung cấp mã viết sẵn):**
   - Chỉ ra mục tiêu kỹ thuật và hành vi mong đợi một cách rõ ràng.
   - Tuyệt đối không viết sẵn đoạn mã thay thế (no drop-in snippets) để cộng tác viên tự tư duy, tìm hiểu tài liệu và tự viết mã giải quyết vấn đề.

---

## 4. Kế hoạch kiểm thử (Testing Strategy)

1. **Unit Tests (`tests/pr-gate-check.test.mjs`):**
   - Test ca PR sửa `apps/web/src/app/(public)/page.tsx` nhưng thiếu ảnh trong body -> Thất bại, gắn nhãn `needs-visual-proof`.
   - Test ca PR sửa UI có đính kèm ảnh Markdown `![demo](https://...)` -> Thành công.
   - Test ca PR sửa UI có đính kèm video Loom `https://www.loom.com/share/abc123xyz` -> Thành công.
   - Test ca PR chỉ sửa backend `apps/api/` và ghi `N/A - Không có thay đổi giao diện` -> Thành công.
   - Test ca PR sửa component UI nhưng ghi `N/A` dối trá -> Thất bại.
   - Test ca PR cố tình sửa `scripts/pr-gate-check.mjs` -> Thất bại, cảnh báo can thiệp hạ tầng.
   - Test ca PR cố tình sửa `.github/workflows/ci.yml` -> Thất bại, cảnh báo can thiệp hạ tầng.

2. **Integration Verification:**
   - Chạy `pnpm typecheck`, `pnpm lint`, `pnpm format:check`, `pnpm test`, `pnpm docs:check` đảm bảo 100% xanh.
