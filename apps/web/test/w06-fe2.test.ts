import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const webRoot = path.resolve(__dirname, "..");

describe("W06-FE2: Toi uu Offline PWA, Trang phap ly/FAQ va Huong dan su dung", () => {
  describe("1. Cau hinh Web App Manifest, Service Worker & Dang ky PWA", () => {
    it("manifest.webmanifest hop le, che do standalone va dung route chuan /gate/scanner", () => {
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
        manifest.shortcuts.some((s) => s.url === "/gate/scanner"),
        true,
      );
      assert.equal(
        manifest.shortcuts.some((s) => s.url === "/gate-scanner"),
        false,
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

    it("Root layout khai bao manifest va gan PwaRegistrar goi navigator.serviceWorker.register", () => {
      const layoutPath = path.join(webRoot, "src", "app", "layout.tsx");
      const registrarPath = path.join(
        webRoot,
        "src",
        "shared",
        "ui",
        "pwa-registrar.tsx",
      );
      assert.equal(fs.existsSync(layoutPath), true);
      assert.equal(fs.existsSync(registrarPath), true);

      const layoutContent = fs.readFileSync(layoutPath, "utf8");
      const registrarContent = fs.readFileSync(registrarPath, "utf8");
      assert.equal(layoutContent.includes("/manifest.webmanifest"), true);
      assert.equal(layoutContent.includes("PwaRegistrar"), true);
      assert.equal(
        registrarContent.includes("navigator.serviceWorker.register"),
        true,
      );
    });
  });

  describe("2. Trang Phap ly / FAQ (/faq) va Huong dan su dung (/guide) dung Hien chuong", () => {
    it("Trang /faq dung muc hoan FLEXIBLE (100%, 50%, 0%), giu cho 5 phut va khong nhac hang cho ao", () => {
      const routePath = path.join(
        webRoot,
        "src",
        "app",
        "(public)",
        "faq",
        "page.tsx",
      );
      const featurePath = path.join(
        webRoot,
        "src",
        "features",
        "support",
        "ui",
        "faq-page.tsx",
      );
      assert.equal(fs.existsSync(routePath), true);
      assert.equal(fs.existsSync(featurePath), true);

      const content = fs.readFileSync(featurePath, "utf8");
      assert.equal(content.includes("13/2023/NĐ-CP"), true);
      assert.equal(content.includes("UC06"), true);
      assert.equal(content.includes("FLEXIBLE"), true);
      assert.equal(content.includes("100%"), true);
      assert.equal(content.includes("50%"), true);
      assert.equal(content.includes("0%"), true);
      assert.equal(content.includes("5 phút"), true);

      assert.equal(content.includes("70%"), false);
      assert.equal(content.includes("10 phút"), false);
      assert.equal(content.includes("600 giây"), false);
      assert.equal(content.includes("Virtual Waiting Room"), false);
      assert.equal(content.includes("hàng chờ ảo"), false);
    });

    it("Trang /guide su dung next/image, giu cho 5 phut va tro dung route /gate/scanner", () => {
      const routePath = path.join(
        webRoot,
        "src",
        "app",
        "(public)",
        "guide",
        "page.tsx",
      );
      const featurePath = path.join(
        webRoot,
        "src",
        "features",
        "support",
        "ui",
        "guide-page.tsx",
      );
      assert.equal(fs.existsSync(routePath), true);
      assert.equal(fs.existsSync(featurePath), true);

      const content = fs.readFileSync(featurePath, "utf8");
      assert.equal(content.includes('from "next/image"'), true);
      assert.equal(content.includes("Người mua vé"), true);
      assert.equal(content.includes("Ban tổ chức"), true);
      assert.equal(content.includes("Nhân viên soát vé"), true);
      assert.equal(content.includes("5 phút"), true);
      assert.equal(content.includes("/gate/scanner"), true);

      assert.equal(content.includes("10 phút"), false);
      assert.equal(content.includes("/gate-scanner"), false);
    });
  });
});
