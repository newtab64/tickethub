import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";

const WEB = path.resolve(import.meta.dirname, "..");
const css = readFileSync(path.join(WEB, "src/app/globals.css"), "utf8");

const walk = (dir: string): string[] =>
  readdirSync(dir).flatMap((name) => {
    const full = path.join(dir, name);
    if (statSync(full).isDirectory()) return walk(full);
    return /\.(tsx?|css|svg|webmanifest|js)$/.test(name) ? [full] : [];
  });
const sources = ["src", "public"].flatMap((d) => walk(path.join(WEB, d)));
const offenders = (pattern: RegExp) =>
  sources
    .filter((file) => pattern.test(readFileSync(file, "utf8")))
    .map((file) => path.relative(WEB, file));

const token = (name: string) => {
  const value = css.match(new RegExp(`\\s--${name}:\\s*(#[0-9a-f]{6});`))?.[1];
  assert.ok(value, `thieu token --${name}`);
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

describe("Design tokens: mau nhan cham", () => {
  test("gia tri token dung thiet ke", () => {
    const expected = {
      primary: "#4338ca",
      "primary-strong": "#3730a3",
      accent: "#eef2ff",
      "accent-foreground": "#3730a3",
      ring: "#6366f1",
      "pay-bar": "#1e1b4b",
      "pay-bar-muted": "#c7d2fe",
      success: "#047857",
      "success-soft": "#ecfdf5",
      "success-border": "#a7f3d0",
    };
    for (const [name, value] of Object.entries(expected)) {
      assert.equal(token(name), value, name);
    }
    for (const name of ["success", "success-soft", "success-border"]) {
      assert.ok(css.includes(`--color-${name}: var(--${name});`), name);
    }
    assert.match(
      css,
      /--shadow-pay-bar:\s*0 10px 28px rgb\(30 27 75 \/ 0\.35\)/,
    );
  });

  test("moi cap chu va nen dat tuong phan 4.5", () => {
    const white = "#ffffff";
    const pairs: [string, string][] = [
      [white, token("primary")],
      [white, token("primary-strong")],
      [token("accent-foreground"), token("accent")],
      [token("primary"), white],
      [token("primary"), token("checkout-page")],
      [token("pay-bar-muted"), token("pay-bar")],
      [white, token("pay-bar")],
      [token("success"), white],
      [token("success"), token("success-soft")],
    ];
    for (const [fg, bg] of pairs) {
      assert.ok(contrast(fg, bg) >= 4.5, `${fg} tren ${bg}`);
    }
  });

  test("khong con ma mau thuong hieu cu", () => {
    assert.deepEqual(offenders(/#(059669|065f46|10b981|06382b|a9cfc1)/i), []);
    const manifest = JSON.parse(
      readFileSync(path.join(WEB, "public/manifest.webmanifest"), "utf8"),
    );
    assert.equal(manifest.theme_color, "#4338ca");
  });

  test("khong goi thang lop mau xanh cua Tailwind", () => {
    assert.deepEqual(offenders(/(emerald|green|teal)-\d/), []);
  });

  test("cho mang nghia thanh cong dung token success", () => {
    for (const file of [
      "event/ui/event-detail-page.tsx",
      "booking/ui/checkout-drawer.tsx",
      "booking/ui/subtotal-modal.tsx",
      "identity/ui/forgot-password-page.tsx",
      "identity/ui/register-step.tsx",
      "identity/ui/verify-email-page.tsx",
      "organizer/domain/display-status.ts",
      "organizer/ui/profile-page.tsx",
      "settlement/ui/reconciliation-view.tsx",
      "payment/ui/payment-result-page.tsx",
      "moderation/ui/event-control-status.tsx",
      "organizer/ui/wizard-header.tsx",
    ]) {
      const source = readFileSync(path.join(WEB, "src/features", file), "utf8");
      assert.match(source, /(text|bg|border)-success/, file);
    }
  });

  test("thong bao luu ho so thanh cong dung token success", () => {
    const source = readFileSync(
      path.join(WEB, "src/features/organizer/ui/profile-page.tsx"),
      "utf8",
    );
    assert.match(
      source,
      /\{savedMessage && \([\s\S]{0,160}?bg-success-soft[^"]*text-success/,
    );
  });

  test("chu tren nen toi cua hero dat tuong phan 4.5", () => {
    const hero = readFileSync(
      path.join(WEB, "src/features/support/ui/support-hero.tsx"),
      "utf8",
    );
    const eyebrow = hero.match(/uppercase tracking-wider text-([a-z-]+)"/)?.[1];
    assert.ok(eyebrow, "khong tim thay nhan hero");
    assert.ok(contrast(token(eyebrow), token("surface-dark")) >= 4.5, eyebrow);
  });

  test("nut Don hang cua toi noi bat tren header trang", () => {
    const shell = readFileSync(
      path.join(WEB, "src/shared/ui/flow-shell.tsx"),
      "utf8",
    );
    assert.match(
      shell,
      /border border-primary\/30 bg-accent [^"]*text-accent-foreground/,
    );
  });
});
