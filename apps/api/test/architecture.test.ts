import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";

/**
 * Kiem tra tu dong quy tac phu thuoc cua kien truc DDD (docs/ARCHITECTURE.md):
 * domain <- application <- interface, infrastructure chi phu thuoc domain,
 * cac context chi tuong tac qua cong (port) va lop lap rap (module, composition).
 */
const SRC = path.resolve(__dirname, "../src");
const CONTEXTS = path.join(SRC, "contexts");
const LAYERS = [
  "domain",
  "application",
  "infrastructure",
  "interface",
] as const;
type Layer = (typeof LAYERS)[number] | "root";

// Ngoai le co chu dich, moi muc deu duoc ghi ro ly do trong docs/ARCHITECTURE.md
const INTERFACE_MAY_USE_INFRASTRUCTURE = new Set([
  // Luong SSE tra ve Observable truc tiep tu adapter Redis Pub/Sub
  "event/interface/events.controller.ts",
  // Tien trinh nen (entrypoint) la noi lap rap adapter
  "notification/interface/outbox.dispatcher.ts",
  "notification/interface/outbox-recovery.ts",
  "notification/interface/email.worker.ts",
  "payment/interface/refund-processor.ts",
]);
const INTERFACE_MAY_USE_DATABASE_AND_CONFIG = new Set([
  "notification/interface/outbox.dispatcher.ts",
  "notification/interface/outbox-recovery.ts",
  "notification/interface/email.worker.ts",
  "payment/interface/refund-processor.ts",
  // Guard doc bi mat JWT tu cau hinh
  "identity/interface/guards/jwt-auth.guard.ts",
  // Guard lay client Redis qua token DI de gioi han tan suat
  "search/interface/search-rate-limit.guard.ts",
]);

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = path.join(dir, name);
    return statSync(full).isDirectory()
      ? walk(full)
      : full.endsWith(".ts")
        ? [full]
        : [];
  });
}

function specifiers(source: string): string[] {
  const out: string[] = [];
  const re = /(?:from|import)\s*\(?\s*["']([^"']+)["']/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(source)) !== null) out.push(m[1]!);
  return out;
}

interface Located {
  file: string;
  rel: string; // contexts/<ctx>/...
  context: string;
  layer: Layer;
}

function locate(file: string): Located {
  const rel = path.relative(CONTEXTS, file).split(path.sep).join("/");
  const [context, second] = rel.split("/");
  const layer = (LAYERS as readonly string[]).includes(second ?? "")
    ? (second as Layer)
    : "root";
  return { file, rel, context: context!, layer };
}

const files = walk(CONTEXTS).map(locate);

function violations(): string[] {
  const found: string[] = [];
  for (const f of files) {
    if (f.layer === "root") continue; // *.module.ts, *.composition.ts: lop lap rap
    for (const spec of specifiers(readFileSync(f.file, "utf8"))) {
      const report = (why: string) => found.push(`${f.rel}: "${spec}" ${why}`);

      if (!spec.startsWith(".")) {
        if (f.layer === "domain" || f.layer === "application") {
          const ok =
            spec === "@tickethub/shared" ||
            spec === "zod" ||
            spec.startsWith("node:");
          if (!ok) report(`khong duoc dung o tang ${f.layer}`);
        }
        continue;
      }

      const target = path.resolve(path.dirname(f.file), spec);
      const inContexts = target.startsWith(CONTEXTS + path.sep);
      const rel = inContexts
        ? path.relative(CONTEXTS, target).split(path.sep).join("/")
        : "";
      const [tCtx, tLayer] = rel.split("/");

      if (target.startsWith(path.join(SRC, "shared-kernel"))) continue;

      const toDatabaseOrConfig =
        target.startsWith(path.join(SRC, "database")) ||
        target.startsWith(path.join(SRC, "config"));

      if (!inContexts) {
        if (
          toDatabaseOrConfig &&
          (f.layer === "infrastructure" ||
            (f.layer === "interface" &&
              INTERFACE_MAY_USE_DATABASE_AND_CONFIG.has(f.rel)))
        ) {
          continue;
        }
        report("tro ra ngoai context khong duoc phep");
        continue;
      }

      if (tCtx !== f.context) {
        // Tang interface duoc dung guard va decorator cua Identity
        const identityApi =
          f.layer === "interface" &&
          tCtx === "identity" &&
          tLayer === "interface";
        if (!identityApi) report(`phu thuoc truc tiep context "${tCtx}"`);
        continue;
      }

      const allowedTargets: Record<Layer, string[]> = {
        domain: ["domain"],
        application: ["domain", "application"],
        infrastructure: ["domain", "infrastructure"],
        interface: ["domain", "application", "interface"],
        root: [],
      };
      const ok =
        allowedTargets[f.layer].includes(tLayer ?? "") ||
        (f.layer === "interface" &&
          tLayer === "infrastructure" &&
          INTERFACE_MAY_USE_INFRASTRUCTURE.has(f.rel));
      if (!ok) report(`tang ${f.layer} khong duoc phu thuoc tang ${tLayer}`);
    }
  }
  return found;
}

describe("Architecture: DDD layer and context boundaries", () => {
  it("discovers every bounded context with the four layers", () => {
    const contexts = new Set(files.map((f) => f.context));
    assert.ok(contexts.size >= 12, `contexts: ${[...contexts].join(", ")}`);
    for (const ctx of contexts) {
      const layers = new Set(
        files.filter((f) => f.context === ctx).map((f) => f.layer),
      );
      assert.ok(layers.has("domain"), `${ctx} thieu tang domain`);
      assert.ok(layers.has("application"), `${ctx} thieu tang application`);
    }
  });

  it("keeps domain and application free of frameworks, database and other contexts", () => {
    const found = violations().filter((v) =>
      /^[a-z]+\/(domain|application)\//.test(v),
    );
    assert.deepEqual(found, []);
  });

  it("keeps infrastructure from depending on application or interface", () => {
    const found = violations().filter((v) =>
      /^[a-z]+\/infrastructure\//.test(v),
    );
    assert.deepEqual(found, []);
  });

  it("only lets interface reach infrastructure, database or config through documented exceptions", () => {
    const found = violations().filter((v) => /^[a-z]+\/interface\//.test(v));
    assert.deepEqual(found, []);
  });

  it("has no leftover legacy module folders under src", () => {
    const top = readdirSync(SRC).filter((n) =>
      statSync(path.join(SRC, n)).isDirectory(),
    );
    const legacy = [
      "admin",
      "auth",
      "booking",
      "events",
      "jobs",
      "payments",
      "payouts",
      "refunds",
      "search",
      "tickets",
      "uploads",
      "venues",
    ];
    assert.deepEqual(
      top.filter((n) => legacy.includes(n)),
      [],
    );
  });
});
