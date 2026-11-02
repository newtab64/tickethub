# PR Gate & AI Reviewer Skill Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Trien khai he thong 2 lop gom GitHub PR checklist template, workflow PR gate tu dong dong PR vi pham / huy CI nang, va AI skill pr-reviewer cho PM danh gia sau ma nguon.

**Architecture:** Lop 1 su dung `.github/pull_request_template.md` ket hop script kiem tra doc lap `scripts/pr-gate-check.mjs` chay trong workflow `pull_request_target` (`.github/workflows/pr-gate.yml`) de tu dong reject, gan nhan, va tu dong phuc hoi khi sua; Lop 2 la skill `.agents/skills/pr-reviewer/SKILL.md` ho tro PM quet tinh, doi chieu contract va tao bao cao chat luong 4 phan.

**Tech Stack:** GitHub Actions, GitHub Script / Octokit, Node.js (native test runner), Bash / gh cli, Markdown.

**Spec:** [docs/superpowers/specs/2026-11-01-pr-gate-and-review-skill-design.md](file:///home/user/Downloads/Repos/ticket-hub/docs/superpowers/specs/2026-11-01-pr-gate-and-review-skill-design.md)

## Global Constraints

- Khong su dung emoji trong commit message, ma nguon, workflow comment va tai lieu bao cao.
- Khong su dung dau gach ngang dai (em-dash); su dung dau hai cham, dau gach noi hoac dau ngoac don.
- Tat ca duong dan file phai co the click duoc voi scheme `file://`.
- Ngon ngu giao tiep va bao cao su dung tieng Viet.
- Workflow PR gate phai hoat dong an toan tren ca nhanh noi bo va nhanh fork thong qua `pull_request_target`.

## Review Focus

- Input co chua cac checkbox bat buoc chua duoc tich (`[ ]`) phai bi phat hien va tra ve loi chinh xac ten muc bi thieu.
- PR title hoac commit message chua emoji (vi du: `:sparkles:`, Unicode emoji) hoac dau em-dash phai bi danh dau vi pham `invalid-commit`.
- Khi contributor sua description va tich du cac checkbox (`[x]`), engine phai nhan dien la hop le, tra ve danh sach label can go bo (`needs-checklist`).
- PR template khong duoc chua bat ky emoji nao de tranh vi pham quy tac commit/docs cua repository.
- Script kiem tra PR gate phai co the chay doc lap bang Node.js ca tren may cuc bo va tren CI GitHub Actions runner.

---

### Task 1: Tao GitHub PR Checklist Template

**Files:**

- Create: `.github/pull_request_template.md`

**Interfaces:**

- Consumes: [docs/superpowers/specs/2026-11-01-pr-gate-and-review-skill-design.md](file:///home/user/Downloads/Repos/ticket-hub/docs/superpowers/specs/2026-11-01-pr-gate-and-review-skill-design.md#L69-L79)
- Produces: Template chuan cho moi Pull Request moi tren GitHub repository.

- [ ] **Step 1: Viet template Pull Request tai `.github/pull_request_template.md`**
      Noi dung gom 4 phan ro rang:
  1. Phan loai thay doi (feat, fix, refactor, docs, chore).
  2. Kiem tra ky thuat truoc khi gui (typecheck, lint, format, test).
  3. Cam ket chat luong ma nguon (khong mock client-side, khong `any`, dung token mau, khong emoji/em-dash).
  4. Danh sach ca kiem thu (Test cases).

- [ ] **Step 2: Kiem tra khong chua emoji va khong chua em-dash trong template**
      Run: `grep -P "[\x{2014}\x{2013}]" .github/pull_request_template.md` va kiem tra Unicode emoji.
      Expected: Khong co ky tu vi pham.

- [ ] **Step 3: Commit**
  ```bash
  git add .github/pull_request_template.md
  git commit -m "docs(github): tao pull request checklist template bat buoc"
  ```

---

### Task 2: Phat trien PR Gate Validation Engine va Unit Tests

**Files:**

- Create: `scripts/pr-gate-check.mjs`
- Create: `tests/pr-gate-check.test.mjs`

**Interfaces:**

- Consumes: Object chua `{ title, body, commits }` tu GitHub PR context hoac CLI arguments.
- Produces: Ham `validatePullRequest({ title, body, commits })` tra ve:

  ```ts
  {
    valid: boolean,
    errors: string[],
    labelsToAdd: string[],
    labelsToRemove: string[]
  }
  ```

- [ ] **Step 1: Viet bo kiem thu unit test tai `tests/pr-gate-check.test.mjs`**
      Kiem tra cac truong hop:
  - PR hop le: body tich du cac checkbox bat buoc, title dung chuan, commit dung chuan -> `valid: true`.
  - PR loi checklist: thieu checkbox hoac chua tich `[ ]` -> `valid: false`, `labelsToAdd` chua `needs-checklist`.
  - PR loi commit: commit chua emoji hoac em-dash -> `valid: false`, `labelsToAdd` chua `invalid-commit`.
  - PR sua loi phuc hoi: body da tich du `[x]` -> `valid: true`, `labelsToRemove` chua `needs-checklist`.

- [ ] **Step 2: Chay kiem thu de xac nhan that bai truoc khi viet code**
      Run: `node --test tests/pr-gate-check.test.mjs`
      Expected: FAIL voi loi khong tim thay module `scripts/pr-gate-check.mjs`.

- [ ] **Step 3: Trien khai engine `validatePullRequest` tai `scripts/pr-gate-check.mjs`**
  - Quet body bang regex kiem tra cac checkbox bat buoc trong checklist.
  - Quet title va commit message voi regex Conventional Commits va regex emoji `/\p{Extended_Pictographic}/u` cung nhu ky tu em-dash.
  - Ho tro ca che do CLI `node scripts/pr-gate-check.mjs --title "..." --body "..."` de tien dung trong bash/CI.

- [ ] **Step 4: Chay kiem thu unit test de xac nhan toan bo pass**
      Run: `node --test tests/pr-gate-check.test.mjs`
      Expected: All tests PASS.

- [ ] **Step 5: Commit**
  ```bash
  git add scripts/pr-gate-check.mjs tests/pr-gate-check.test.mjs
  git commit -m "feat(ci): bo sung pr gate validation engine va unit tests"
  ```

---

### Task 3: Trien khai GitHub Actions PR Gate Workflow

**Files:**

- Create: `.github/workflows/pr-gate.yml`

**Interfaces:**

- Consumes: `scripts/pr-gate-check.mjs`, su kien `pull_request_target` cua GitHub Actions.
- Produces: Workflow tu dong kiem soat PR, dong PR vi pham, huy CI nang va tu dong mo lai khi PR duoc sua hop le.

- [ ] **Step 1: Tao file `.github/workflows/pr-gate.yml`**
  - Su kien: `pull_request_target: [opened, edited, synchronize, reopened]` voi branches `[unstable, stable]`.
  - Permissions: `pull-requests: write`, `actions: write`, `contents: read`.
  - Steps:
    1. Checkout repository (`ref: ${{ github.event.pull_request.base.ref }}`).
    2. Setup Node.js.
    3. Chay `scripts/pr-gate-check.mjs` truyen thong tin PR tu payload `github.event.pull_request`.
    4. Neu vi pham:
       - Goi GitHub API huy workflow run `ci.yml` dang chay tren cung SHA.
       - Comment chi tiet loi va huong dan sua.
       - Gan label `needs-checklist` hoac `invalid-commit`.
       - Dong PR (`state: closed`).
    5. Neu hop le (sau khi duoc sua):
       - Go bo cac label vi pham cu.
       - Dang comment xac nhan PR dat chuan cong so loai.
       - Neu PR dang o trang thai `closed` do bot dong truoc do, tu dong mo lai PR (`state: open`).

- [ ] **Step 2: Kiem tra cu phap va tinh hop le cua workflow**
      Run: Kiem tra format voi Prettier `pnpm prettier --check .github/workflows/pr-gate.yml` va kiem tra khong co emoji / em-dash.
      Expected: PASS.

- [ ] **Step 3: Commit**
  ```bash
  git add .github/workflows/pr-gate.yml
  git commit -m "ci: them workflow pr gate tu dong kiem soat checklist va commit"
  ```

---

### Task 4: Xay dung Kieu Kien thuc AI Skill `pr-reviewer` cho PM

**Files:**

- Create: `.agents/skills/pr-reviewer/SKILL.md`

**Interfaces:**

- Consumes: PR number tu PM (`gh pr view`, `gh pr diff`).
- Produces: Bao cao danh gia chuyen sau 4 phan dang Markdown artifact va lenh ho tro review GitHub khi PM chap thuan.

- [ ] **Step 1: Tao file `.agents/skills/pr-reviewer/SKILL.md` voi frontmatter chuan**
      Dinh nghia metadata:

  ```yaml
  ---
  name: pr-reviewer
  description: Huong dan AI danh gia chuyen sau Pull Request cho Project Manager, phat hien ma gia lap, vi pham tieu chuan va xuat bao cao chat luong 4 phan.
  ---
  ```

- [ ] **Step 2: Dinh nghia quy trinh kiem tra va cac script quet ma tinh**
  - Quet mock client-side: tim kiem `localStorage`, `sessionStorage`, `Math.random` sinh token, delay timeout gia lap API.
  - Quet TypeScript strictness: tim kiem `any`, `as any`, `@ts-ignore`, `@ts-nocheck`.
  - Quet Token mau: tim kiem regex ma hex `#[0-9a-fA-F]{3,8}` doi chieu voi `docs/DESIGN_TOKENS.md`.
  - Quet quy chuan: kiem tra emoji va em-dash trong ma nguon va commit.
  - Kiem tra contract API: doi chieu route, params, response schema voi `API_CONTRACT.md`.

- [ ] **Step 3: Dinh nghia mau bao cao 4 phan (Markdown Report Template)**
  1. Phan ket luan & Quyet dinh (Verdict: APPROVE / REQUEST_CHANGES / REJECT).
  2. Cac loi chan hop nhat nghiem trong (Blockers).
  3. Canh bao ma kem chat luong (Trash Code / Code Smells).
  4. Khuyen nghi va huong dan sua chi tiet kem file va dong code.

- [ ] **Step 4: Dinh nghia quy trinh ho tro dang review len GitHub (PM Confirmed)**
      Huong dan chi dang comment / review len GitHub khi PM chu dong phe duoc, su dung `gh pr review`.

- [ ] **Step 5: Kiem tra khong co emoji hoac em-dash trong file skill**
      Run: `grep -P "[\x{2014}\x{2013}]" .agents/skills/pr-reviewer/SKILL.md` va kiem tra regex emoji.
      Expected: Khong co ky tu vi pham.

- [ ] **Step 6: Commit**
  ```bash
  git add .agents/skills/pr-reviewer/SKILL.md
  git commit -m "feat(skills): tao ky nang ai pr-reviewer danh gia pull request cho pm"
  ```

---

### Task 5: Kiem thu tich hop toan dien (Verification & Integration Testing)

**Files:**

- Modify/Execute: `tests/pr-gate-check.test.mjs`, `scripts/pr-gate-check.mjs`

- [ ] **Step 1: Chay toan bo test suite monorepo**
      Run: `pnpm test`
      Expected: Toan bo cac bai test deu PASS.

- [ ] **Step 2: Chay kiem tra typecheck, lint va format tren toan bo repository**
      Run: `pnpm typecheck && pnpm lint && pnpm format:check`
      Expected: 0 errors, 0 warnings tren packages/shared va apps/api.

- [ ] **Step 3: Thu nghiem mo phong kich ban thuc te tren PR mo san**
      Chay thu nghiem script kiem tra voi body thuc te tu PR #15 hoac PR #22 de xac nhan do chinh xac.
      Expected: Output JSON chinh xac theo dung tieu chuan.

- [ ] **Step 4: Commit tong ket**
  ```bash
  git commit --allow-empty -m "chore: hoan tat kiem thu tich hop he thong pr gate va review skill"
  ```
