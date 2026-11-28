import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";

const WEB = path.resolve(import.meta.dirname, "..");
const read = (file: string) =>
  readFileSync(path.join(WEB, "src", file), "utf8");
const css = read("app/globals.css");

// File đã đưa về chuẩn. Mỗi đợt làm mới trang thêm file vào đây.
const STANDARD_FILES = [
  ...["button", "input", "card", "dialog", "badge"].map(
    (name) => `shared/ui/${name}.tsx`,
  ),
  ...[
    "buyer-order-detail-page",
    "order-details",
    "order-tickets-card",
    "refund-dialog",
    "ticket-qr-dialog",
  ].map((name) => `features/booking/ui/${name}.tsx`),
];
const LOGO = "shared/ui/logo.tsx";

const RULES: [string, RegExp][] = [
  ["cỡ chữ ngoài chuẩn", /\btext-(xs|sm|base|lg|xl|[2-9]xl)\b/],
  [
    "cỡ chữ ngoài 28, 17, 15, 13px",
    /\btext-\[(?!(28|17|15|13)px\])[\d.]+(px|rem)\]/,
  ],
  ["độ đậm ngoài 400 và 600", /\bfont-(light|medium|bold|extrabold|black)\b/],
  ["mã màu hex", /#[0-9a-fA-F]{3,8}\b/],
  [
    "bảng màu Tailwind thô",
    /\b(bg|text|border|ring)-(slate|rose|blue|gray|zinc|amber)-\d/,
  ],
];

const token = (name: string) => {
  const value = css.match(new RegExp(`\\s--${name}:\\s*(#[0-9a-f]{6});`))?.[1];
  assert.ok(value, `thiếu token --${name}`);
  return value;
};

function contrast(a: string, b: string) {
  const luminance = (hex: string) =>
    [1, 3, 5]
      .map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
      .map((v) => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4))
      .reduce((sum, v, i) => sum + v * [0.2126, 0.7152, 0.0722][i]!, 0);
  const [high, low] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (high! + 0.05) / (low! + 0.05);
}

describe("Chuẩn giao diện", () => {
  for (const file of STANDARD_FILES) {
    test(`${file} đúng chuẩn`, () => {
      const source = read(file);
      const broken = RULES.filter(([label, pattern]) => {
        if (file === LOGO && label.startsWith("độ đậm")) return false;
        return pattern.test(source);
      }).map(([label, pattern]) => `${label}: ${source.match(pattern)![0]}`);
      assert.deepEqual(broken, []);
    });
  }

  test("ô nhập kiểu B: nền field, viên thuốc, cao 48px", () => {
    assert.equal(token("field"), "#eceef1");
    assert.ok(css.includes("--color-field: var(--field);"));
    assert.ok(contrast(token("muted-foreground"), token("field")) >= 4.5);
    for (const name of ["input", "custom-select", "date-picker"]) {
      const source = read(`shared/ui/${name}.tsx`);
      assert.match(source, /h-12 [^"`]*rounded-full [^"`]*bg-field/, name);
    }
  });

  test("nút cao tối thiểu 44px", () => {
    assert.doesNotMatch(
      read("shared/ui/button.tsx"),
      /\b(h|size)-(6|7|8|9|10)\b/,
    );
  });

  test("hộp thoại tắt hiệu ứng khi giảm chuyển động", () => {
    assert.match(read("shared/ui/dialog.tsx"), /motion-reduce:animate-none/);
  });
});
