# Nâng cấp PR Gate: Minh chứng Trực quan và Chống Gian lận Hạ tầng Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Bổ sung cơ chế bắt buộc đính kèm minh chứng hình ảnh/video khi thay đổi giao diện (`apps/web`) và cơ chế tự động ngăn chặn sửa lén các tệp kịch bản kiểm soát / workflow / bộ test của PR Strict Gate.

**Architecture:** Mở rộng engine kiểm duyệt [scripts/pr-gate-check.mjs](file:///home/user/Downloads/Repos/ticket-hub/scripts/pr-gate-check.mjs) nhận diện danh sách `changedFiles`, áp dụng bộ lọc tệp được bảo vệ nghiêm ngặt (Protected Infrastructure Files) và bộ lọc tệp UI trực quan (`apps/web/src/**`). Bổ sung mục minh chứng trực quan vào [.github/pull_request_template.md](file:///home/user/Downloads/Repos/ticket-hub/.github/pull_request_template.md), cập nhật workflow [.github/workflows/pr-gate.yml](file:///home/user/Downloads/Repos/ticket-hub/.github/workflows/pr-gate.yml) và nâng cấp kỹ năng [.agents/skills/pr-reviewer/SKILL.md](file:///home/user/Downloads/Repos/ticket-hub/.agents/skills/pr-reviewer/SKILL.md).

**Tech Stack:** Node.js (ESM), JavaScript Regular Expressions, GitHub Actions (`actions/github-script`), Markdown, Node.js Test Runner.

**Spec:** [docs/superpowers/specs/2026-11-01-pr-gate-visual-proof-and-tamper-guard-design.md](file:///home/user/Downloads/Repos/ticket-hub/docs/superpowers/specs/2026-11-01-pr-gate-visual-proof-and-tamper-guard-design.md).

## Global Constraints

- Tuyệt đối không sử dụng biểu tượng cảm xúc (emoji) trong commit message, mã nguồn, tài liệu và mô tả PR.
- Tuyệt đối không sử dụng ký tự gạch ngang dài (em-dash: `—` hoặc `–`). Sử dụng dấu hai chấm, dấu gạch ngang ngắn `-` hoặc dấu ngoặc đơn.
- Sử dụng tiếng Việt có dấu chuẩn mực cho tài liệu và thông điệp.
- Duy trì 100% tính tương thích với các PR không thay đổi giao diện (PR backend, tài liệu, cấu hình không bị yêu cầu ảnh vô lý).

## Review Focus

- Nhận diện đúng tệp UI: Chỉ bắt buộc ảnh/video với các tệp giao diện hiển thị (`.tsx`, `.jsx`, `.css` thuộc `apps/web/src/`), không bắt buộc với tệp test, tệp helper logic (`src/lib/utils.ts`) hay API route backend (`src/app/api/**`).
- Bắt lỗi khai báo dối trá: Nếu PR có sửa component/page UI mà phần minh chứng lại ghi `N/A`, Gate phải phát hiện và chặn lại ngay lập tức.
- Chống gian lận hạ tầng (Anti-tampering): Mọi hành vi sửa `scripts/pr-gate-*`, `scripts/audit-doc-*`, `.github/workflows/*` và `tests/pr-gate-*` phải bị phát hiện và chặn đứng (hard block).
- Toàn bộ unit tests và test suite monorepo phải vượt qua 100%.

---

### Task 1: Cập nhật Biểu mẫu PR Template và Kỹ năng AI PR Reviewer

**Files:**

- Modify: `.github/pull_request_template.md`
- Modify: `.agents/skills/pr-reviewer/SKILL.md`

- [ ] **Step 1: Cập nhật `.github/pull_request_template.md`**
  - Thêm cam kết chống can thiệp hạ tầng vào Mục 3:
    `- [ ] Không can thiệp trái phép vào hạ tầng kiểm soát (không sửa đổi .github/workflows/, scripts/pr-gate-*, scripts/audit-doc-*, tests/pr-gate-*)`
  - Thêm Mục 6:
    ```markdown
    ## 6. Minh chứng trực quan (Visual Evidence)

    Bắt buộc đính kèm ít nhất 1 hình ảnh hoặc video minh chứng nếu PR có thay đổi giao diện người dùng (UI/UX) tại `apps/web`:

    <!-- Dán ảnh chụp màn hình hoặc liên kết video (Loom, YouTube, Drive, MP4) tại đây -->
    <!-- Nếu PR chỉ sửa Backend hoặc Logic không có giao diện hiển thị, ghi rõ: N/A - Không có thay đổi giao diện -->
    ```

- [ ] **Step 2: Nâng cấp Kỹ năng AI PR Reviewer (`.agents/skills/pr-reviewer/SKILL.md`)**
  - Mở rộng quy trình đánh giá 5 bước thành quy trình phân tích chuyên sâu 6 bước:
    1. Trích xuất bối cảnh (Context Extraction): Xác định Use Case, vai trò contributor và các tài liệu hợp đồng liên quan.
    2. Bóc tách hành động của contributor (What the Contributor Did): Phân tích luồng dữ liệu (Data flow), danh sách component/route mới, các điểm đạt yêu cầu.
    3. Quét tĩnh các lỗi cấm, gian lận và can thiệp hạ tầng (Zero Tolerance / Anti-Tampering).
    4. Kiểm tra minh chứng trực quan: Xác minh có ảnh/video khi sửa UI (`apps/web/src/**`).
    5. Chẩn đoán chuyên sâu điều gì sai (What's Wrong): Nêu rõ `File:Line`, hiện trạng sai, kỳ vọng đúng và hậu quả trên production.
    6. Khuyến nghị định hướng kỹ thuật rõ ràng: Nêu yêu cầu chuẩn mực và hành vi mong đợi, tuyệt đối không cung cấp mã viết sẵn (no drop-in snippets) để contributor tự tư duy và triển khai giải pháp.
  - Cập nhật cấu trúc báo cáo 4 phần sang mẫu báo cáo toàn diện dành cho Quản lý dự án (PM).

- [ ] **Step 3: Commit các cập nhật tài liệu mẫu và kỹ năng**
  ```bash
  git add .github/pull_request_template.md .agents/skills/pr-reviewer/SKILL.md
  git commit -m "docs(ci): cap nhat bieu mau pr checklist va quy trinh ai pr reviewer"
  ```

---

### Task 2: Nâng cấp Kịch bản Gate Check (`scripts/pr-gate-check.mjs`) theo TDD

**Files:**

- Modify: `tests/pr-gate-check.test.mjs`
- Modify: `scripts/pr-gate-check.mjs`

- [ ] **Step 1: Viết các ca kiểm thử thất bại mới trong `tests/pr-gate-check.test.mjs`**
  - Ca 1: PR sửa `apps/web/src/app/(public)/page.tsx` nhưng thiếu ảnh/video trong Mục 6 -> Fail, gán nhãn `needs-visual-proof`.
  - Ca 2: PR sửa `apps/web/src/components/events/seat-map.tsx` có ảnh Markdown `![SeatMap](https://...)` -> Pass.
  - Ca 3: PR sửa `apps/web/src/app/(event)/events/[id]/page.tsx` có video link `https://www.loom.com/share/abc123xyz` -> Pass.
  - Ca 4: PR chỉ sửa backend `apps/api/src/auth/auth.service.ts` và ghi `N/A - Không có thay đổi giao diện` -> Pass.
  - Ca 5: PR sửa `apps/web/src/components/ui/button.tsx` nhưng ghi `N/A - Không có thay đổi giao diện` -> Fail (khai báo gian lận).
  - Ca 6: PR sửa `.github/workflows/pr-gate.yml` -> Fail (Security Blocker, phát hiện can thiệp hạ tầng kiểm soát).
  - Ca 7: PR sửa `scripts/pr-gate-check.mjs` -> Fail (Security Blocker).
  - Ca 8: PR sửa `tests/pr-gate-check.test.mjs` -> Fail (Security Blocker).
  - Ca 9: PR bỏ quên checkbox cam kết hạ tầng -> Fail (`needs-checklist`).

- [ ] **Step 2: Chạy kiểm thử để xác nhận các ca mới thất bại (RED)**

  ```bash
  node --test tests/pr-gate-check.test.mjs
  ```

  Expected: Các ca test mới thất bại do `scripts/pr-gate-check.mjs` chưa cài đặt logic.

- [ ] **Step 3: Cài đặt logic kiểm duyệt trong `scripts/pr-gate-check.mjs` (GREEN)**
  - Thêm `PROTECTED_INFRASTRUCTURE_PATTERNS`:
    - `.github/workflows/`
    - `scripts/pr-gate-`
    - `scripts/audit-doc-`
    - `tests/pr-gate-`
    - `tests/audit-doc-`
  - Thêm hàm kiểm tra tệp giao diện `isVisualUiFile(filePath)`:
    - Khớp với `apps/web/src/` kết thúc bằng `.tsx`, `.jsx`, `.css`, `.module.css`.
    - Loại trừ `apps/web/src/lib/`, `apps/web/src/proxy.ts`, `apps/web/src/app/api/`.
  - Thêm hàm kiểm tra minh chứng media `hasValidVisualEvidence(body)`:
    - Nhận diện cú pháp ảnh Markdown: `!\[.*?\]\(.+?\)`
    - Nhận diện cú pháp HTML img: `<img\s+[^>]*src=["'].+?["']`
    - Nhận diện đường dẫn ảnh/video: PNG, JPG, JPEG, GIF, WEBP, MP4, WEBM, hoặc host Loom, YouTube, Google Drive.
  - Xử lý gán nhãn:
    - Thêm nhãn `needs-visual-proof` nếu thiếu minh chứng UI.
    - Thêm nhãn `security-violation` nếu can thiệp tệp hạ tầng.

- [ ] **Step 4: Chạy lại toàn bộ unit tests để xác nhận vượt qua (GREEN)**

  ```bash
  node --test tests/pr-gate-check.test.mjs
  ```

  Expected: Toàn bộ tests PASS.

- [ ] **Step 5: Commit các thay đổi**
  ```bash
  git add scripts/pr-gate-check.mjs tests/pr-gate-check.test.mjs
  git commit -m "feat(ci): tich hop quy tac bat buoc minh chung truc quan va chong gian lan ha tang"
  ```

---

### Task 3: Tích hợp Lấy danh sách Tệp thay đổi vào Workflow GitHub Actions

**Files:**

- Modify: `.github/workflows/pr-gate.yml`

- [ ] **Step 1: Cập nhật `.github/workflows/pr-gate.yml`**
  - Thêm bước gọi GitHub API `github.paginate(github.rest.pulls.listFiles, ...)` để lấy toàn bộ `filename` của PR.
  - Truyền mảng `changedFiles` vào hàm `validatePullRequest({ title, body, commits, changedFiles, docParity })`.
  - Bổ sung xử lý thêm/gỡ nhãn `needs-visual-proof` và `security-violation`.
  - Bổ sung nội dung thông báo cụ thể khi PR bị chặn do thiếu ảnh minh chứng hoặc do can thiệp tệp kiểm soát.

- [ ] **Step 2: Commit thay đổi workflow**
  ```bash
  git add .github/workflows/pr-gate.yml
  git commit -m "feat(ci): truyen danh sach tep thay doi vao pr gate workflow"
  ```

---

### Task 4: Kiểm thử Tích hợp Toàn diện Monorepo và Hoàn tất

**Files:**

- Execute: Monorepo test & verification commands

- [ ] **Step 1: Chạy kiểm tra kiểu dữ liệu TypeScript**

  ```bash
  pnpm typecheck
  ```

  Expected: 0 lỗi.

- [ ] **Step 2: Chạy kiểm tra linting**

  ```bash
  pnpm lint
  ```

  Expected: 0 lỗi vi phạm.

- [ ] **Step 3: Chạy định dạng và kiểm tra Prettier**

  ```bash
  pnpm format
  pnpm format:check
  ```

  Expected: 100% chuẩn định dạng.

- [ ] **Step 4: Chạy kiểm tra đối soát tài liệu kiến trúc**

  ```bash
  pnpm docs:check
  ```

  Expected: PASS với 0 mâu thuẫn.

- [ ] **Step 5: Chạy toàn bộ bộ kiểm thử monorepo**

  ```bash
  pnpm test
  ```

  Expected: Toàn bộ các bài kiểm thử đều PASS.

- [ ] **Step 6: Tạo PR mới, xác minh GitHub Actions và hợp nhất vào `unstable`**
  - Đẩy nhánh lên GitHub.
  - Tạo PR với mô tả chuẩn có đính kèm đầy đủ checklist.
  - Kiểm tra kết quả CI trên GitHub và hợp nhất vào `unstable`.
