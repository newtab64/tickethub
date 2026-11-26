import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync, existsSync } from "node:fs";
import path from "node:path";

/**
 * Kiem tra tu dong quy tac phu thuoc cua frontend (docs/ARCHITECTURE.md):
 *   app/ (ghep route mong)  ->  features/<ctx>/index.ts  ->  features/<ctx>/{ui,api,domain}
 *   shared/ khong biet feature nao; cac feature chi dung nhau qua index.ts.
 * Rieng proxy.ts va route handler duoc dung diem vao may chu `features/<ctx>/server`.
 */
const SRC = path.resolve(import.meta.dirname, "../src");

function walk(dir: string): string[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir).flatMap((name) => {
    const full = path.join(dir, name);
    return statSync(full).isDirectory()
      ? walk(full)
      : /\.(ts|tsx)$/.test(name)
        ? [full]
        : [];
  });
}

interface Import {
  spec: string;
  typeOnly: boolean;
}

function imports(source: string): Import[] {
  const out: Import[] = [];
  const fromRe =
    /(?:^|\n)\s*(?:import|export)\s+(type\s+)?[^;"']*?from\s*["']([^"']+)["']/g;
  const dynamicRe = /import\s*\(\s*["']([^"']+)["']\s*\)/g;
  const sideEffectRe = /(?:^|\n)\s*import\s+["']([^"']+)["']/g;
  let m: RegExpExecArray | null;
  while ((m = fromRe.exec(source)) !== null) {
    out.push({ spec: m[2]!, typeOnly: Boolean(m[1]) });
  }
  while ((m = dynamicRe.exec(source)) !== null) {
    out.push({ spec: m[1]!, typeOnly: false });
  }
  while ((m = sideEffectRe.exec(source)) !== null) {
    out.push({ spec: m[1]!, typeOnly: false });
  }
  return out;
}

/** Quy ve duong dan so voi src (khong phan mo rong), hoac null neu la goi ngoai. */
function resolveInternal(file: string, spec: string): string | null {
  if (spec.startsWith("@/")) return spec.slice(2);
  if (spec.startsWith(".")) {
    return path
      .relative(SRC, path.resolve(path.dirname(file), spec))
      .split(path.sep)
      .join("/");
  }
  return null;
}

const REACT_OR_NEXT =
  /^(react|react-dom|next|next\/.*|@tanstack\/.*|lucide-react|radix-ui|react-hook-form)$/;

interface Violation {
  file: string;
  spec: string;
  why: string;
}

const isFeatureIndex = (target: string, feature: string) =>
  target === `features/${feature}` || target === `features/${feature}/index`;

const isFeatureServerEntry = (target: string, feature: string) =>
  target === `features/${feature}/server`;

function check(): Violation[] {
  const found: Violation[] = [];
  for (const file of walk(SRC)) {
    const rel = path.relative(SRC, file).split(path.sep).join("/");
    const [top, feature, layer] = rel.split("/");
    const source = readFileSync(file, "utf8");

    for (const { spec, typeOnly } of imports(source)) {
      const internal = resolveInternal(file, spec);
      const add = (why: string) => found.push({ file: rel, spec, why });
      const target = internal ?? "";
      const [tTop, tFeature, tLayer] = target.split("/");

      // shared/ khong duoc biet feature hay app
      if (top === "shared" && internal !== null) {
        if (internal.startsWith("features/") || internal.startsWith("app/")) {
          add("shared/ khong duoc phu thuoc features/ hoac app/");
        }
      }

      if (top === "features" && feature && layer) {
        if (layer === "domain") {
          if (!internal && REACT_OR_NEXT.test(spec)) {
            add("domain khong duoc dung React/Next/UI");
          }
          if (internal) {
            const sameDomain =
              tTop === "features" &&
              tFeature === feature &&
              tLayer === "domain";
            const sharedLib = tTop === "shared" && tFeature === "lib";
            // Kieu cua feature khac qua index.ts (import type bi xoa luc bien dich)
            const foreignType =
              typeOnly &&
              tTop === "features" &&
              tFeature !== feature &&
              isFeatureIndex(target, tFeature!);
            if (!sameDomain && !sharedLib && !foreignType) {
              add(
                "domain chi duoc phu thuoc domain cung feature, shared/lib va kieu cua feature khac qua index.ts",
              );
            }
          }
        }

        if (layer === "api") {
          if (!internal && REACT_OR_NEXT.test(spec)) {
            add("api khong duoc dung React/UI");
          }
          if (
            internal &&
            tTop === "features" &&
            tFeature === feature &&
            tLayer === "ui"
          ) {
            add("api khong duoc phu thuoc ui");
          }
        }

        if (internal && tTop === "features" && tFeature !== feature) {
          if (!isFeatureIndex(target, tFeature!)) {
            add(`chi duoc import feature "${tFeature}" qua index.ts`);
          }
        }
      }

      // app/ va proxy chi ghep route: khong vao ruot cua feature
      if ((top === "app" || rel === "proxy.ts") && internal) {
        if (tTop === "features") {
          const ok =
            isFeatureIndex(target, tFeature!) ||
            isFeatureServerEntry(target, tFeature!);
          if (!ok) {
            add(
              `app/ chi duoc import feature "${tFeature}" qua index.ts hoac server.ts`,
            );
          }
        }
      }
    }
  }
  return found;
}

describe("Frontend architecture: feature boundaries", () => {
  test("shared/ does not depend on features/ or app/", () => {
    const v = check().filter((x) => x.file.startsWith("shared/"));
    assert.deepEqual(v, []);
  });

  test("feature domain layers are pure and stay inside their feature", () => {
    const v = check().filter((x) => /^features\/[^/]+\/domain\//.test(x.file));
    assert.deepEqual(v, []);
  });

  test("feature api layers do not depend on UI", () => {
    const v = check().filter((x) => /^features\/[^/]+\/api\//.test(x.file));
    assert.deepEqual(v, []);
  });

  test("features and app only reach other features through index.ts", () => {
    const v = check().filter((x) => x.why.includes("index.ts"));
    assert.deepEqual(v, []);
  });

  test("has no legacy folders left under src", () => {
    const legacy = ["components", "lib", "providers", "validations"];
    const top = readdirSync(SRC).filter((n) =>
      statSync(path.join(SRC, n)).isDirectory(),
    );
    assert.deepEqual(
      top.filter((n) => legacy.includes(n)),
      [],
    );
  });

  test("keeps route page files thin (composition only)", () => {
    const MAX_LINES = 40;
    const tooLong = walk(path.join(SRC, "app"))
      .filter((f) => path.basename(f) === "page.tsx")
      .map((f) => ({
        file: path.relative(SRC, f).split(path.sep).join("/"),
        lines: readFileSync(f, "utf8").split("\n").length,
      }))
      .filter((x) => x.lines > MAX_LINES);
    assert.deepEqual(tooLong, []);
  });
});
