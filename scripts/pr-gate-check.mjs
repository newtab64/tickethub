#!/usr/bin/env node

/**
 * PR Gate Validation Engine
 * Kiểm tra tính hợp lệ của PR checklist, tiêu đề, commit message,
 * bảo vệ hạ tầng kiểm soát và bắt buộc minh chứng trực quan khi sửa UI.
 */

const EMOJI_REGEX = /\p{Extended_Pictographic}/u;
const EM_DASH_REGEX = /[\u2013\u2014]/;
const CONVENTIONAL_COMMIT_REGEX = /^(feat|fix|docs|refactor|test|chore)(\([a-zA-Z0-9_.\-/]+\))?:\s.+/;

const REQUIRED_PREFLIGHT_PATTERNS = [
  {
    name: 'pnpm typecheck',
    regex: /-\s*\[([ xX])\]\s*.*`pnpm typecheck`/,
  },
  {
    name: 'pnpm lint',
    regex: /-\s*\[([ xX])\]\s*.*`pnpm lint`/,
  },
  {
    name: 'pnpm format:check',
    regex: /-\s*\[([ xX])\]\s*.*`pnpm format:check`/,
  },
  {
    name: 'pnpm test',
    regex: /-\s*\[([ xX])\]\s*.*`pnpm test`/,
  },
];

const REQUIRED_QUALITY_PATTERNS = [
  {
    name: 'Không chứa mã giả lập ở client',
    regex: /-\s*\[([ xX])\]\s*.*(?:chứa|chua)\s+(?:mã|ma)\s+(?:giả|gia)\s+(?:lập|lap)\s+.*client/i,
  },
  {
    name: 'Không sử dụng kiểu any',
    regex: /-\s*\[([ xX])\]\s*.*(?:sử|su)\s+(?:dụng|dung)\s+(?:kiểu|kieu)\s+`?any`?/i,
  },
  {
    name: 'Tuân thủ token màu tại docs/DESIGN_TOKENS.md',
    regex: /-\s*\[([ xX])\]\s*.*token\s+(?:màu|mau)/i,
  },
  {
    name: 'Không chứa biểu tượng cảm xúc (emoji)',
    regex: /-\s*\[([ xX])\]\s*.*(?:biểu|bieu)\s+(?:tượng|tuong)\s+(?:cảm|cam)\s+(?:xúc|xuc)\s*\(emoji\)/i,
  },
  {
    name: 'Không chứa ký tự gạch ngang dài (em-dash)',
    regex: /-\s*\[([ xX])\]\s*.*(?:gạch|gach)\s+(?:ngang|ngang)\s+(?:dài|dai)\s*\(em-dash\)/i,
  },
  {
    name: 'Không can thiệp trái phép vào hạ tầng kiểm soát',
    regex: /-\s*\[([ xX])\]\s*.*(?:hạ|ha)\s+(?:tầng|tang)\s+(?:kiểm|kiem)\s+(?:soát|soat)/i,
  },
];

const PR_TYPE_PATTERN = /-\s*\[([xX])\]\s*`(feat|fix|docs|refactor|chore)`/;

export const PROTECTED_INFRASTRUCTURE_PATTERNS = [
  /^\.github\/workflows\//,
  /^scripts\/pr-gate-/,
  /^scripts\/audit-doc-/,
  /^tests\/pr-gate-/,
  /^tests\/audit-doc-/,
];

export function isProtectedInfrastructureFile(filePath) {
  return PROTECTED_INFRASTRUCTURE_PATTERNS.some((pattern) => pattern.test(filePath));
}

export function isVisualUiFile(filePath) {
  if (!filePath.startsWith('apps/web/src/')) {
    return false;
  }
  // Loại trừ logic helper, proxy, api routes
  if (
    filePath.startsWith('apps/web/src/lib/') ||
    filePath === 'apps/web/src/proxy.ts' ||
    filePath === 'apps/web/src/proxy.js' ||
    filePath.startsWith('apps/web/src/app/api/')
  ) {
    return false;
  }
  // Loại trừ unit test
  if (/\.(test|spec)\.[a-zA-Z0-9]+$/.test(filePath)) {
    return false;
  }
  // Khớp với các tệp giao diện hiển thị
  return /\.(tsx|jsx|css|module\.css)$/.test(filePath);
}

const MARKDOWN_IMAGE_REGEX = /!\[.*?\]\(.+?\)/;
const HTML_IMAGE_REGEX = /<img\s+[^>]*src=["'].+?["']/i;
const MEDIA_URL_REGEX = /https?:\/\/\S+\.(png|jpe?g|gif|webp|svg|mp4|webm|mov)(\?[^\s<>]*)?/i;
const VIDEO_HOST_REGEX = /https?:\/\/(?:www\.)?(?:loom\.com\/share\/|youtube\.com\/|youtu\.be\/|drive\.google\.com\/)\S+/i;
const FRAUDULENT_NA_REGEX = /\bN\/A\b|không có thay đổi giao diện|khong co thay doi giao dien/i;

export function hasValidVisualEvidence(body = '') {
  return (
    MARKDOWN_IMAGE_REGEX.test(body) ||
    HTML_IMAGE_REGEX.test(body) ||
    MEDIA_URL_REGEX.test(body) ||
    VIDEO_HOST_REGEX.test(body)
  );
}

export function validatePullRequest({
  title = '',
  body = '',
  commits = [],
  docParity = null,
  changedFiles = [],
}) {
  const errors = [];
  const warnings = [];
  const labelsToAdd = [];
  const labelsToRemove = [];

  let checklistHasErrors = false;
  let commitHasErrors = false;
  let securityHasErrors = false;
  let visualHasErrors = false;

  const normalizedBody = body || '';

  // 1. Kiểm tra loại PR
  if (!PR_TYPE_PATTERN.test(normalizedBody)) {
    errors.push('Loại thay đổi (PR Type) chưa được chọn. Vui lòng tích ít nhất một loại (feat, fix, docs, refactor, chore).');
    checklistHasErrors = true;
  }

  // 2. Kiểm tra Pre-flight checks
  for (const item of REQUIRED_PREFLIGHT_PATTERNS) {
    const match = normalizedBody.match(item.regex);
    if (!match) {
      errors.push(`Mục kiểm tra bắt buộc bị thiếu: "${item.name}".`);
      checklistHasErrors = true;
    } else if (match[1].toLowerCase() !== 'x') {
      errors.push(`Mục kiểm tra bắt buộc chưa được tích: "${item.name}".`);
      checklistHasErrors = true;
    }
  }

  // 3. Kiểm tra Cam kết chất lượng mã nguồn
  for (const item of REQUIRED_QUALITY_PATTERNS) {
    const match = normalizedBody.match(item.regex);
    if (!match) {
      errors.push(`Cam kết bắt buộc bị thiếu: "${item.name}".`);
      checklistHasErrors = true;
    } else if (match[1].toLowerCase() !== 'x') {
      errors.push(`Cam kết bắt buộc chưa được xác nhận: "${item.name}".`);
      checklistHasErrors = true;
    }
  }

  // 4. Kiểm tra Tiêu đề PR
  const trimmedTitle = title.trim();
  if (EMOJI_REGEX.test(trimmedTitle)) {
    errors.push('Tiêu đề PR chứa biểu tượng cảm xúc (emoji). Vui lòng gỡ bỏ emoji theo CONTRIBUTING.md.');
    commitHasErrors = true;
  }
  if (EM_DASH_REGEX.test(trimmedTitle)) {
    errors.push('Tiêu đề PR chứa ký tự gạch ngang dài (em-dash). Vui lòng thay thế bằng dấu hai chấm, dấu gạch nối hoặc dấu ngoặc đơn.');
    commitHasErrors = true;
  }
  if (!CONVENTIONAL_COMMIT_REGEX.test(trimmedTitle)) {
    errors.push('Tiêu đề PR không đúng quy chuẩn Conventional Commits. Cú pháp hợp lệ: <type>(<scope>): <mô tả ngắn gọn>');
    commitHasErrors = true;
  }

  // 5. Kiểm tra Commit messages
  const commitList = Array.isArray(commits) ? commits : [];
  for (const commitItem of commitList) {
    const message = (typeof commitItem === 'string' ? commitItem : commitItem.message || '').trim();
    if (!message) continue;

    const firstLine = message.split('\n')[0].trim();

    // Cho phép commit merge tiêu chuẩn
    if (/^Merge (branch|remote-tracking branch|pull request)/.test(firstLine)) {
      continue;
    }

    if (EMOJI_REGEX.test(message)) {
      errors.push(`Commit "${firstLine}" chứa biểu tượng cảm xúc (emoji). Vui lòng reword và gỡ bỏ emoji.`);
      commitHasErrors = true;
    }
    if (EM_DASH_REGEX.test(message)) {
      errors.push(`Commit "${firstLine}" chứa ký tự gạch ngang dài (em-dash). Vui lòng thay thế bằng dấu gạch nối hoặc dấu hai chấm.`);
      commitHasErrors = true;
    }
    if (!CONVENTIONAL_COMMIT_REGEX.test(firstLine)) {
      errors.push(`Commit "${firstLine}" không tuân thủ Conventional Commits. Cú pháp hợp lệ: <type>(<scope>): <mô tả>`);
      commitHasErrors = true;
    }
  }

  // 6. Kiểm tra bảo vệ hạ tầng kiểm soát (Anti-Tampering Guard)
  const fileList = Array.isArray(changedFiles) ? changedFiles : [];
  const protectedFilesModified = fileList.filter((file) => isProtectedInfrastructureFile(file));
  if (protectedFilesModified.length > 0) {
    errors.push(
      `Phát hiện can thiệp hạ tầng kiểm soát được bảo vệ: ${protectedFilesModified.join(', ')}. ` +
      `Các tệp workflow và kịch bản PR Gate không được phép sửa đổi trong PR tính năng thông thường.`
    );
    securityHasErrors = true;
  }

  // 7. Kiểm tra minh chứng trực quan khi sửa UI (Visual Evidence Verification)
  const uiFilesModified = fileList.filter((file) => isVisualUiFile(file));
  const hasUiChanges = uiFilesModified.length > 0;

  if (hasUiChanges) {
    const hasMedia = hasValidVisualEvidence(normalizedBody);
    const declaresNA = FRAUDULENT_NA_REGEX.test(normalizedBody);

    if (declaresNA && !hasMedia) {
      errors.push(
        `PR có thay đổi tệp giao diện (${uiFilesModified.join(', ')}) nhưng khai báo N/A trong mục minh chứng trực quan. ` +
        `Bắt buộc đính kèm ít nhất 1 ảnh chụp hoặc liên kết video minh chứng.`
      );
      visualHasErrors = true;
    } else if (!hasMedia) {
      errors.push(
        `PR có thay đổi giao diện người dùng (${uiFilesModified.join(', ')}) nhưng thiếu hình ảnh hoặc video minh chứng tại Mục 6.`
      );
      visualHasErrors = true;
    }
  }

  // Xử lý nhãn (labels)
  if (checklistHasErrors) {
    labelsToAdd.push('needs-checklist');
  } else {
    labelsToRemove.push('needs-checklist');
  }

  if (commitHasErrors) {
    labelsToAdd.push('invalid-commit');
  } else {
    labelsToRemove.push('invalid-commit');
  }

  if (securityHasErrors) {
    labelsToAdd.push('security-violation');
  } else {
    labelsToRemove.push('security-violation');
  }

  if (visualHasErrors) {
    labelsToAdd.push('needs-visual-proof');
  } else {
    labelsToRemove.push('needs-visual-proof');
  }

  // 8. Kiểm tra tính đồng bộ tài liệu (Soft warning: không tính vào errors)
  if (docParity && !docParity.valid) {
    if (docParity.tableMismatches && docParity.tableMismatches.length > 0) {
      for (const t of docParity.tableMismatches) {
        warnings.push(`[ERD Drift] ${t.reason}`);
      }
    }
    if (docParity.endpointMismatches && docParity.endpointMismatches.length > 0) {
      for (const e of docParity.endpointMismatches) {
        warnings.push(`[API Contract Drift] ${e.reason}`);
      }
    }
    labelsToAdd.push('needs-doc-update');
  } else if (docParity && docParity.valid) {
    labelsToRemove.push('needs-doc-update');
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    labelsToAdd,
    labelsToRemove,
  };
}

// Chạy trực tiếp qua CLI nếu được gọi từ dòng lệnh
if (process.argv[1] && process.argv[1].endsWith('pr-gate-check.mjs')) {
  const args = process.argv.slice(2);
  let title = '';
  let body = '';
  let changedFiles = [];

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--title' && args[i + 1]) {
      title = args[i + 1];
      i++;
    } else if (args[i] === '--body' && args[i + 1]) {
      body = args[i + 1];
      i++;
    } else if (args[i] === '--changed-files' && args[i + 1]) {
      changedFiles = args[i + 1].split(',').map((f) => f.trim()).filter(Boolean);
      i++;
    }
  }

  const result = validatePullRequest({ title, body, commits: [], changedFiles });
  console.log(JSON.stringify(result, null, 2));
  process.exit(result.valid ? 0 : 1);
}
