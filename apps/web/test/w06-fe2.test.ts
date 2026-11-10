import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const webRoot = path.resolve(__dirname, "..");

describe("W06-FE2: Toi uu Offline PWA, Trang phap ly/FAQ va Huong dan su dung", () => {
  describe("1. Cau hinh Web App Manifest & Service Worker (Offline PWA)", () => {
    it("manifest.webmanifest hop le, che do standalone va co shortcuts cho Ve cua toi & Soat ve", () => {
      const manifestPath = path.join(webRoot, "public", "manifest.webmanifest");
      assert.equal(fs.existsSync(manifestPath), true);

      const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8")) as {
        name: string;
        short_name: string;
        display: string;
        start_url: string;
        shortcuts: Array<{ url: string }>;
      };

      assert.equal(manifest.short_name, "TicketHub");
      assert.equal(manifest.display, "standalone");
      assert.equal(manifest.start_url, "/my-tickets");
      assert.equal(
        manifest.shortcuts.some((s) => s.url === "/my-tickets"),
        true,
      );
      assert.equal(
        manifest.shortcuts.some((s) => s.url === "/gate-scanner"),
        true,
      );
    });

    it("Service Worker (sw.js) precache /my-tickets, /faq, /guide va khong cache luong SSE", () => {
      const swPath = path.join(webRoot, "public", "sw.js");
      assert.equal(fs.existsSync(swPath), true);

      const swContent = fs.readFileSync(swPath, "utf8");
      assert.equal(swContent.includes('"/my-tickets"'), true);
      assert.equal(swContent.includes('"/faq"'), true);
      assert.equal(swContent.includes('"/guide"'), true);
      assert.equal(swContent.includes("/seats/stream"), true);
    });
  });

  describe("2. Trang Phap ly / FAQ (/faq) va Huong dan su dung (/guide)", () => {
    it("Trang /faq chua day du Dieu khoan, Chinh sach bao mat Nghi dinh 13/2023 va Hoan ve UC06", () => {
      const faqPath = path.join(
        webRoot,
        "src",
        "app",
        "(public)",
        "faq",
        "page.tsx",
      );
      assert.equal(fs.existsSync(faqPath), true);

      const content = fs.readFileSync(faqPath, "utf8");
      assert.equal(content.includes("13/2023/NĐ-CP"), true);
      assert.equal(content.includes("UC06"), true);
      assert.equal(content.includes("100%"), true);
      assert.equal(content.includes("70%"), true);
    });

    it("Trang /guide su dung next/image va huong dan day du 3 vai tro (Nguoi mua, BTC, Nhan vien soat ve)", () => {
      const guidePath = path.join(
        webRoot,
        "src",
        "app",
        "(public)",
        "guide",
        "page.tsx",
      );
      assert.equal(fs.existsSync(guidePath), true);

      const content = fs.readFileSync(guidePath, "utf8");
      assert.equal(content.includes('from "next/image"'), true);
      assert.equal(content.includes("Người mua vé"), true);
      assert.equal(content.includes("Ban tổ chức"), true);
      assert.equal(content.includes("Nhân viên soát vé"), true);
    });
  });
});
