import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, statSync } from "node:fs";
import path from "node:path";
import { UserRole } from "@tickethub/shared";
import { accountMenuItems } from "../src/features/identity/domain/account-menu.ts";

const APP = path.resolve(import.meta.dirname, "../src/app");
const routes = (dir: string, prefix = ""): string[] =>
  readdirSync(dir).flatMap((name) => {
    const full = path.join(dir, name);
    if (name === "page.tsx") return [prefix || "/"];
    if (!statSync(full).isDirectory()) return [];
    return routes(full, name.startsWith("(") ? prefix : `${prefix}/${name}`);
  });

const labels = (role: UserRole) => accountMenuItems(role).map((i) => i.label);

describe("Account menu", () => {
  test("nguoi mua co loi vao ban ve va tro giup, khong co muc quan ly", () => {
    assert.deepEqual(accountMenuItems(UserRole.BUYER), [
      { href: "/register?role=ORGANIZER", label: "Bán vé trên tickethub" },
      { href: "/faq", label: "Trợ giúp" },
    ]);
  });

  test("ban to chuc co muc quan ly, khong co muc ban ve", () => {
    assert.deepEqual(labels(UserRole.ORGANIZER), [
      "Quản lý sự kiện",
      "Tạo sự kiện",
      "Hồ sơ",
      "Trợ giúp",
    ]);
  });

  test("quan tri co cong quan tri", () => {
    assert.deepEqual(labels(UserRole.ADMIN), ["Cổng quản trị", "Trợ giúp"]);
  });

  test("moi lien ket tro toi route dang ton tai", () => {
    const known = new Set(routes(APP));
    for (const role of Object.values(UserRole)) {
      for (const { href } of accountMenuItems(role)) {
        assert.ok(known.has(href.split("?")[0]!), `${role}: ${href}`);
      }
    }
  });
});
