import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { validatePullRequest } from '../scripts/pr-gate-check.mjs';

const VALID_PR_BODY_ACCENTED = `
## 1. Loại thay đổi (PR Type)
- [x] \`feat\`: Tính năng mới
- [ ] \`fix\`: Sửa lỗi hệ thống

## 2. Kiểm tra kỹ thuật trước khi gửi (Pre-flight Checks)
- [x] Đã chạy \`pnpm typecheck\` và không có lỗi TypeScript
- [x] Đã chạy \`pnpm lint\` và không có lỗi vi phạm quy tắc lint
- [x] Đã chạy \`pnpm format:check\` và mã nguồn đã được định dạng nhất quán
- [x] Đã chạy \`pnpm test\` và tất cả các bài kiểm thử đều vượt qua (PASS)

## 3. Cam kết chất lượng mã nguồn (Code Quality Guarantees)
- [x] Không chứa mã giả lập ở client (không dùng localStorage hoặc mock để thay thế API backend)
- [x] Không sử dụng kiểu \`any\` (dùng schema Zod hoặc kiểu \`unknown\` có kiểm tra kiểu)
- [x] Tuân thủ token màu tại \`docs/DESIGN_TOKENS.md\` (không dùng mã hex thô không khai báo)
- [x] Không chứa biểu tượng cảm xúc (emoji) trong commit message và nội dung trao đổi
- [x] Không chứa ký tự gạch ngang dài (em-dash) trong commit message và nội dung
- [x] Không can thiệp trái phép vào hạ tầng kiểm soát (không sửa đổi .github/workflows/, scripts/pr-gate-*, scripts/audit-doc-*, tests/pr-gate-*)

## 4. Danh sách ca kiểm thử (Test Cases)
- Ca kiểm thử 1: Kiểm tra gate thành công

## 6. Minh chứng trực quan (Visual Evidence)
N/A - Không có thay đổi giao diện
`;

describe('validatePullRequest', () => {
  it('passes when PR body and commits are completely valid with accented Vietnamese', () => {
    const result = validatePullRequest({
      title: 'feat(api): them tinh nang phan quyen',
      body: VALID_PR_BODY_ACCENTED,
      commits: [
        { message: 'feat(api): them middleware phan quyen' },
        { message: 'test(api): bo sung unit test cho auth guard' },
      ],
    });

    assert.equal(result.valid, true);
    assert.deepEqual(result.errors, []);
    assert.ok(result.labelsToRemove.includes('needs-checklist'));
    assert.ok(result.labelsToRemove.includes('invalid-commit'));
    assert.equal(result.labelsToAdd.length, 0);
  });

  it('fails when required checklist items are unchecked', () => {
    const invalidBody = VALID_PR_BODY_ACCENTED.replace(
      '- [x] Đã chạy `pnpm typecheck`',
      '- [ ] Đã chạy `pnpm typecheck`'
    );

    const result = validatePullRequest({
      title: 'feat(api): them tinh nang phan quyen',
      body: invalidBody,
      commits: [{ message: 'feat(api): them middleware phan quyen' }],
    });

    assert.equal(result.valid, false);
    assert.ok(result.errors.some((err) => err.includes('pnpm typecheck')));
    assert.ok(result.labelsToAdd.includes('needs-checklist'));
  });

  it('fails when no PR type is selected', () => {
    const invalidBody = VALID_PR_BODY_ACCENTED.replace(
      '- [x] `feat`: Tính năng mới',
      '- [ ] `feat`: Tính năng mới'
    );

    const result = validatePullRequest({
      title: 'feat(api): them tinh nang phan quyen',
      body: invalidBody,
      commits: [{ message: 'feat(api): them middleware phan quyen' }],
    });

    assert.equal(result.valid, false);
    assert.ok(result.errors.some((err) => err.includes('Loại thay đổi')));
    assert.ok(result.labelsToAdd.includes('needs-checklist'));
  });

  it('fails when commit message contains emoji', () => {
    const result = validatePullRequest({
      title: 'feat(api): them tinh nang',
      body: VALID_PR_BODY_ACCENTED,
      commits: [
        { message: 'feat(api): them tinh nang \u{1F389}' },
      ],
    });

    assert.equal(result.valid, false);
    assert.ok(result.errors.some((err) => err.includes('emoji')));
    assert.ok(result.labelsToAdd.includes('invalid-commit'));
  });

  it('fails when commit body contains emoji', () => {
    const result = validatePullRequest({
      title: 'feat(api): them tinh nang',
      body: VALID_PR_BODY_ACCENTED,
      commits: [
        { message: 'feat(api): them tinh nang\n\nNội dung body chứa emoji \u{1F680}' },
      ],
    });

    assert.equal(result.valid, false);
    assert.ok(result.errors.some((err) => err.includes('emoji')));
    assert.ok(result.labelsToAdd.includes('invalid-commit'));
  });

  it('fails when commit message contains em-dash', () => {
    const result = validatePullRequest({
      title: 'feat(api): them tinh nang',
      body: VALID_PR_BODY_ACCENTED,
      commits: [
        { message: 'feat(api): them tinh nang \u2014 bo sung role guard' },
      ],
    });

    assert.equal(result.valid, false);
    assert.ok(result.errors.some((err) => err.includes('em-dash')));
    assert.ok(result.labelsToAdd.includes('invalid-commit'));
  });

  it('fails when PR title does not follow conventional commit format', () => {
    const result = validatePullRequest({
      title: 'Update code and fix bugs',
      body: VALID_PR_BODY_ACCENTED,
      commits: [{ message: 'feat(api): them tinh nang' }],
    });

    assert.equal(result.valid, false);
    assert.ok(result.errors.some((err) => err.includes('Tiêu đề PR không đúng quy chuẩn')));
    assert.ok(result.labelsToAdd.includes('invalid-commit'));
  });

  it('handles empty body gracefully and marks as invalid checklist', () => {
    const result = validatePullRequest({
      title: 'feat(api): them tinh nang',
      body: '',
      commits: [{ message: 'feat(api): them tinh nang' }],
    });

    assert.equal(result.valid, false);
    assert.ok(result.labelsToAdd.includes('needs-checklist'));
  });

  it('adds soft warning and needs-doc-update label when doc parity fails without breaking valid status', () => {
    const result = validatePullRequest({
      title: 'feat(api): them tinh nang phan quyen',
      body: VALID_PR_BODY_ACCENTED,
      commits: [{ message: 'feat(api): them middleware phan quyen' }],
      docParity: {
        valid: false,
        tableMismatches: [{ table: 'new_table', reason: 'Bảng thiếu trong doc' }],
        endpointMismatches: [],
      },
    });

    assert.equal(result.valid, true);
    assert.ok(result.labelsToAdd.includes('needs-doc-update'));
    assert.ok(result.warnings.some((w) => w.includes('ERD Drift')));
  });

  // ==========================================
  // Test cases moi cho Visual Evidence va Anti-Tampering
  // ==========================================

  it('fails and adds needs-visual-proof label when UI file changed but Section 6 has no media', () => {
    const result = validatePullRequest({
      title: 'feat(web): cap nhat giao dien trang chu',
      body: VALID_PR_BODY_ACCENTED.replace('N/A - Không có thay đổi giao diện', ''),
      commits: [{ message: 'feat(web): cap nhat giao dien trang chu' }],
      changedFiles: ['apps/web/src/app/(public)/page.tsx'],
    });

    assert.equal(result.valid, false);
    assert.ok(result.errors.some((err) => err.includes('minh chứng')));
    assert.ok(result.labelsToAdd.includes('needs-visual-proof'));
  });

  it('passes when UI file changed and Section 6 includes markdown image', () => {
    const bodyWithImage = VALID_PR_BODY_ACCENTED.replace(
      'N/A - Không có thay đổi giao diện',
      '![SeatMap Preview](https://github.com/user/repo/assets/123/screenshot.png)'
    );

    const result = validatePullRequest({
      title: 'feat(web): cap nhat so do ghe',
      body: bodyWithImage,
      commits: [{ message: 'feat(web): cap nhat so do ghe' }],
      changedFiles: ['apps/web/src/components/events/seat-map.tsx'],
    });

    assert.equal(result.valid, true);
    assert.equal(result.errors.length, 0);
    assert.ok(result.labelsToRemove.includes('needs-visual-proof'));
  });

  it('passes when UI file changed and Section 6 includes Loom video link', () => {
    const bodyWithVideo = VALID_PR_BODY_ACCENTED.replace(
      'N/A - Không có thay đổi giao diện',
      'Video minh chứng tương tác: https://www.loom.com/share/abc123xyz'
    );

    const result = validatePullRequest({
      title: 'feat(web): cap nhat trang chi tiet su kien',
      body: bodyWithVideo,
      commits: [{ message: 'feat(web): cap nhat trang chi tiet su kien' }],
      changedFiles: ['apps/web/src/app/(event)/events/[id]/page.tsx'],
    });

    assert.equal(result.valid, true);
    assert.equal(result.errors.length, 0);
    assert.ok(result.labelsToRemove.includes('needs-visual-proof'));
  });

  it('passes when only backend files changed and Section 6 declares N/A', () => {
    const result = validatePullRequest({
      title: 'feat(api): them logic auth service',
      body: VALID_PR_BODY_ACCENTED,
      commits: [{ message: 'feat(api): them logic auth service' }],
      changedFiles: ['apps/api/src/auth/auth.service.ts'],
    });

    assert.equal(result.valid, true);
    assert.equal(result.errors.length, 0);
    assert.ok(result.labelsToRemove.includes('needs-visual-proof'));
  });

  it('fails when UI file changed but Section 6 declares N/A fraudulently', () => {
    const result = validatePullRequest({
      title: 'feat(web): sua nut bam',
      body: VALID_PR_BODY_ACCENTED, // declares N/A
      commits: [{ message: 'feat(web): sua nut bam' }],
      changedFiles: ['apps/web/src/components/ui/button.tsx'],
    });

    assert.equal(result.valid, false);
    assert.ok(result.errors.some((err) => err.includes('N/A')));
    assert.ok(result.labelsToAdd.includes('needs-visual-proof'));
  });

  it('fails and adds security-violation label when workflow file changed', () => {
    const result = validatePullRequest({
      title: 'feat(ci): sua workflow pr gate',
      body: VALID_PR_BODY_ACCENTED,
      commits: [{ message: 'feat(ci): sua workflow pr gate' }],
      changedFiles: ['.github/workflows/pr-gate.yml'],
    });

    assert.equal(result.valid, false);
    assert.ok(result.errors.some((err) => err.includes('hạ tầng kiểm soát')));
    assert.ok(result.labelsToAdd.includes('security-violation'));
  });

  it('fails and adds security-violation label when gate script changed', () => {
    const result = validatePullRequest({
      title: 'feat(ci): sua script pr gate check',
      body: VALID_PR_BODY_ACCENTED,
      commits: [{ message: 'feat(ci): sua script pr gate check' }],
      changedFiles: ['scripts/pr-gate-check.mjs'],
    });

    assert.equal(result.valid, false);
    assert.ok(result.errors.some((err) => err.includes('hạ tầng kiểm soát')));
    assert.ok(result.labelsToAdd.includes('security-violation'));
  });

  it('fails and adds security-violation label when gate test changed', () => {
    const result = validatePullRequest({
      title: 'test(ci): sua test pr gate check',
      body: VALID_PR_BODY_ACCENTED,
      commits: [{ message: 'test(ci): sua test pr gate check' }],
      changedFiles: ['tests/pr-gate-check.test.mjs'],
    });

    assert.equal(result.valid, false);
    assert.ok(result.errors.some((err) => err.includes('hạ tầng kiểm soát')));
    assert.ok(result.labelsToAdd.includes('security-violation'));
  });

  it('fails when infrastructure tampering guarantee is unchecked', () => {
    const invalidBody = VALID_PR_BODY_ACCENTED.replace(
      '- [x] Không can thiệp trái phép vào hạ tầng kiểm soát',
      '- [ ] Không can thiệp trái phép vào hạ tầng kiểm soát'
    );

    const result = validatePullRequest({
      title: 'feat(api): them tinh nang phan quyen',
      body: invalidBody,
      commits: [{ message: 'feat(api): them middleware phan quyen' }],
    });

    assert.equal(result.valid, false);
    assert.ok(result.errors.some((err) => err.includes('hạ tầng kiểm soát')));
    assert.ok(result.labelsToAdd.includes('needs-checklist'));
  });
});
