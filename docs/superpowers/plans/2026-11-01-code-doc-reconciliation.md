# Code-Doc Reconciliation & Contract Gate Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Hoa giai toan dien giua ma nguon thuc te va tai lieu kien truc (ERD.md, API_CONTRACT.md, ARCHITECTURE.md), gan nhan [PLANNED] cho cac thuc the tuong lai, va thiet lap cong kiem tra doi soat ngu nghia tu dong pnpm docs:check kem canh bao mem tren PR Gate.

**Architecture:** Su dung script Node.js ESM `scripts/audit-doc-parity.mjs` de doi soat tu dong giua Drizzle schema/NestJS controllers voi Markdown tables trong `docs/ERD.md` va `docs/API_CONTRACT.md`; cap nhat toan bo noi dung tai lieu ve moc chan ly 100% khop voi ma nguon chay on dinh; bo sung buoc canh bao mem vao workflow `pr-gate.yml`.

**Tech Stack:** Node.js (ESM), TypeScript, Drizzle ORM, NestJS Controllers, GitHub Actions, Markdown.

**Spec:** [docs/superpowers/specs/2026-11-01-code-doc-reconciliation-design.md](file:///home/user/Downloads/Repos/ticket-hub/docs/superpowers/specs/2026-11-01-code-doc-reconciliation-design.md)

## Global Constraints

- Khong su dung emoji trong commit message, ma nguon, workflow comment va tai lieu bao cao.
- Khong su dung dau gach ngang dai (em-dash); su dung dau hai cham, dau gach noi hoac dau ngoac don.
- Tat ca duong dan file phai co the click duoc voi scheme `file://`.
- Toan bo noi dung tai lieu va thong bao su dung tieng Viet co dau chuan xac.
- Cac thuc the va route du kien phai duoc gan nhan ro rang `[PLANNED]` de khong bi bao loi thieu code.

## Review Focus

- Bảng hoặc cột trong Drizzle schema có trong code nhưng thiếu trong `docs/ERD.md` phải bị phát hiện.
- Route controller có trong `apps/api/src/` nhưng thiếu trong `docs/API_CONTRACT.md` phải bị phát hiện.
- Endpoint hoặc bảng có trong tài liệu nhưng chưa có code phải được bỏ qua nếu và chỉ nếu có nhãn `[PLANNED]` hoặc `[Dự kiến]`.
- Lệnh `pnpm docs:check` phải chạy độc lập, nhẹ nhàng, không yêu cầu kết nối cơ sở dữ liệu thật.
- Khi PR thay đổi controller/schema mà chưa cập nhật tài liệu, bot PR Gate chỉ gắn nhãn `needs-doc-update` và gửi comment cảnh báo mềm, không hủy CI.

---

### Task 1: Phat trien cong cu doi soat ngu nghia `scripts/audit-doc-parity.mjs` va Unit Tests

**Files:**

- Create: `scripts/audit-doc-parity.mjs`
- Create: `tests/audit-doc-parity.test.mjs`

**Interfaces:**

- Consumes: Thư mục `apps/api/src/database/schema/`, `apps/api/src/**/*.controller.ts`, `docs/ERD.md`, `docs/API_CONTRACT.md`.
- Produces: Hàm `auditDocParity({ schemaDir, controllersDir, erdPath, apiContractPath })` trả về:

  ```ts
  {
    valid: boolean,
    tableMismatches: Array<{ table: string, missingInDoc?: string[], missingInCode?: string[] }>,
    endpointMismatches: Array<{ method: string, path: string, reason: string }>,
    warnings: string[]
  }
  ```

- [ ] **Step 1: Viet bo kiem thu unit test tai `tests/audit-doc-parity.test.mjs`**
      Kiểm tra:
  - Khớp chuẩn: Bảng và endpoint trong code khớp với bảng và endpoint trong doc -> `valid: true`.
  - Thiếu trong doc: Controller có `@Post('reset-password')` nhưng doc không có -> `valid: false`.
  - Nhãn `[PLANNED]`: Doc có `/venues` gắn nhãn `[PLANNED]` nhưng code chưa có -> bỏ qua, không báo lỗi.
  - Lệch cột: Drizzle schema có cột `is_verified` nhưng doc thiếu -> báo lỗi.

- [ ] **Step 2: Chay kiem thu de xac nhan that bai truoc khi viet code**
      Run: `node --test tests/audit-doc-parity.test.mjs`
      Expected: FAIL vì chưa có file `scripts/audit-doc-parity.mjs`.

- [ ] **Step 3: Trien khai engine `auditDocParity` tai `scripts/audit-doc-parity.mjs`**
  - Quét schema files bằng regex trích xuất `pgTable('table_name', { ... })` và danh sách cột.
  - Quét controller files bằng regex trích xuất `@Controller('prefix')` và `@Get/Post/Put/Patch/Delete('path')`.
  - Quét `docs/ERD.md` tìm tiêu đề bảng và cột.
  - Quét `docs/API_CONTRACT.md` tìm các tiêu đề endpoint `POST /api/v1/...` và nhãn `[PLANNED]`.
  - CLI runner: Thoát mã 0 nếu valid, thoát mã 1 nếu phát hiện mâu thuẫn.

- [ ] **Step 4: Chay kiem thu unit test de xac nhan toan bo pass**
      Run: `node --test tests/audit-doc-parity.test.mjs`
      Expected: All unit tests PASS.

- [ ] **Step 5: Commit**
  ```bash
  git add scripts/audit-doc-parity.mjs tests/audit-doc-parity.test.mjs
  git commit -m "feat(docs): tao script doi soat ngu nghia tai lieu va ma nguon"
  ```

---

### Task 2: Chuan hoa toan bo [docs/ERD.md](file:///home/user/Downloads/Repos/ticket-hub/docs/ERD.md)

**Files:**

- Modify: `docs/ERD.md`

**Interfaces:**

- Consumes: Cấu trúc 17 bảng trong `apps/api/src/database/schema/`.
- Produces: `docs/ERD.md` đồng bộ 100% với Drizzle schema, gắn nhãn `[PLANNED]` cho các bảng tương lai.

- [ ] **Step 1: Doi chieu danh sach 17 bang database thuc te**
      Quét các bảng hiện có: `users`, `organizer_profiles`, `events`, `ticket_types`, `seats`, `orders`, `order_items`, `tickets`, `transactions`, `refunds`, `payouts`, `outbox`, `idempotency_keys`, `gates`, `event_staff`, `audit_log`.
      Đánh dấu `[PLANNED]` cho bảng `venues`, `venue_layouts`.

- [ ] **Step 2: Cap nhat so do Mermaid ERD va bang chi tiet cac cot**
      Cập nhật đầy đủ kiểu dữ liệu: UUID, text, integer, timestamp with time zone, jsonb, boolean.
      Đảm bảo không chứa ký tự emoji hoặc em-dash.

- [ ] **Step 3: Chay kiem tra Prettier format**
      Run: `pnpm prettier --check docs/ERD.md`
      Expected: PASS.

- [ ] **Step 4: Commit**
  ```bash
  git add docs/ERD.md
  git commit -m "docs(erd): dong bo so do va cau truc bang du lieu voi drizzle schema"
  ```

---

### Task 3: Chuan hoa [docs/API_CONTRACT.md](file:///home/user/Downloads/Repos/ticket-hub/docs/API_CONTRACT.md) va [docs/ARCHITECTURE.md](file:///home/user/Downloads/Repos/ticket-hub/docs/ARCHITECTURE.md)

**Files:**

- Modify: `docs/API_CONTRACT.md`
- Modify: `docs/ARCHITECTURE.md`

**Interfaces:**

- Consumes: Các controller trong `apps/api/src/`, Zod schemas trong `packages/shared/src/schemas/`.
- Produces: API contract phản ánh chính xác các route thực tế, gắn nhãn `[PLANNED]` cho các route tương lai.

- [ ] **Step 1: Doi chieu tat ca cac route hien co cua Backend**
      Rà soát từng controller:
  - Auth: `/api/v1/auth/*`
  - Events: `/api/v1/events/*`
  - Search: `/api/v1/search/*`
  - Waiting Room: `/api/v1/waiting-room/*`
  - Booking: `/api/v1/booking/*`
  - Payments & VNPay IPN: `/api/v1/payments/*`
  - Admin: `/api/v1/admin/*`
  - Uploads: `/api/v1/uploads/*`
  - Health: `/api/v1/health`
    Gắn nhãn `[PLANNED]` cho các nhóm route chưa có controller: `/venues`, `/tickets`, `/refund`.

- [ ] **Step 2: Cap nhat tai lieu ARCHITECTURE.md**
      Đặc tả chi tiết cơ chế khóa hàng PostgreSQL `SELECT ... FOR UPDATE` sắp xếp `id ASC` khi giữ chỗ vé và Transactional Outbox pattern cho BullMQ email worker.

- [ ] **Step 3: Chay kiem tra Prettier format va ky tu cam**
      Run: `pnpm prettier --check docs/API_CONTRACT.md docs/ARCHITECTURE.md`
      Expected: PASS.

- [ ] **Step 4: Commit**
  ```bash
  git add docs/API_CONTRACT.md docs/ARCHITECTURE.md
  git commit -m "docs(api): dong bo api contract voi controller thuc te va gan nhan planned"
  ```

---

### Task 4: Tich hop lenh `pnpm docs:check` va Canh bao mem vao PR Gate

**Files:**

- Modify: `package.json`
- Modify: `scripts/pr-gate-check.mjs`
- Modify: `.github/workflows/pr-gate.yml`

**Interfaces:**

- Consumes: `scripts/audit-doc-parity.mjs`.
- Produces: Lệnh npm `pnpm docs:check` và chức năng cảnh báo mềm trên PR Gate khi phát hiện trôi lệch tài liệu.

- [ ] **Step 1: Them script `docs:check` vao root `package.json`**
      Thêm: `"docs:check": "node scripts/audit-doc-parity.mjs"`

- [ ] **Step 2: Tich hop buoc kiem tra vao PR Gate engine va workflow**
      Khi PR có thay đổi controller hoặc schema:
  - Chạy `auditDocParity`.
  - Nếu phát hiện mâu thuẫn: thêm nhãn `needs-doc-update` và bổ sung danh mục cảnh báo vào comment của bot.
  - Không đánh fail CI hoặc close PR (soft warning policy).

- [ ] **Step 3: Chay kiem tra toan bo unit tests cua gate check**
      Run: `node --test tests/pr-gate-check.test.mjs`
      Expected: PASS.

- [ ] **Step 4: Commit**
  ```bash
  git add package.json scripts/pr-gate-check.mjs .github/workflows/pr-gate.yml
  git commit -m "feat(ci): tich hop lenh docs check va co che canh bao mem vao pr gate"
  ```

---

### Task 5: Kiem thu tich hop toan dien va Xac minh trang thai Monorepo

**Files:**

- Modify/Execute: `package.json`, `docs/`, `scripts/`

- [ ] **Step 1: Chay lenh `pnpm docs:check` de xac nhan do khop tuyet doi**
      Run: `pnpm docs:check`
      Expected: PASS với 0 mâu thuẫn giữa code và tài liệu.

- [ ] **Step 2: Chay toan bo test suite monorepo**
      Run: `pnpm test`
      Expected: All tests PASS.

- [ ] **Step 3: Chay typecheck, lint va format**
      Run: `pnpm typecheck && pnpm lint && pnpm format:check`
      Expected: 0 errors, 0 warnings.

- [ ] **Step 4: Commit tong ket**
  ```bash
  git commit --allow-empty -m "chore: hoan tat hoa giai toan dien ma nguon va tai lieu kien truc"
  ```
