#!/usr/bin/env node

/**
 * Script doi soat ngu nghia giua Ma nguon thuc te va Tai lieu kien truc.
 * Kiem tra tinh dong bo cua Drizzle Schema vs docs/ERD.md va NestJS Controllers vs docs/API_CONTRACT.md.
 */

import fs from 'node:fs';
import path from 'node:path';

function findFiles(dir, filterRegex) {
  const results = [];
  if (!fs.existsSync(dir)) return results;

  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...findFiles(fullPath, filterRegex));
    } else if (filterRegex.test(entry.name)) {
      results.push(fullPath);
    }
  }
  return results;
}

export function parseSchemaTables(content) {
  const tables = [];
  const tableRegex = /pgTable\(\s*['"]([a-zA-Z0-9_]+)['"]\s*,\s*\{([\s\S]*?)\n\s*\}/g;

  let match;
  while ((match = tableRegex.exec(content)) !== null) {
    const tableName = match[1];
    const columnsBlock = match[2];
    const columns = [];

    const columnRegex = /([a-zA-Z0-9_]+)\s*:\s*(?:uuid|text|varchar|integer|timestamp|boolean|jsonb|serial|pgEnum)\s*\(\s*['"]([a-zA-Z0-9_]+)['"]/g;
    let colMatch;
    while ((colMatch = columnRegex.exec(columnsBlock)) !== null) {
      columns.push(colMatch[2]);
    }

    tables.push({
      name: tableName,
      columns,
    });
  }

  return tables;
}

export function parseControllerEndpoints(content) {
  const endpoints = [];
  const controllerRegex = /@Controller\(\s*(?:['"]([^'"]*)['"])?\s*\)[\s\S]*?export\s+class\s+([A-Za-z0-9_]+)/g;

  let ctrlMatch;
  while ((ctrlMatch = controllerRegex.exec(content)) !== null) {
    const prefix = (ctrlMatch[1] || '').trim();
    const classStart = ctrlMatch.index + ctrlMatch[0].length;
    const nextController = content.indexOf('@Controller(', classStart);
    const classBody = nextController !== -1 ? content.slice(classStart, nextController) : content.slice(classStart);

    const methodRegex = /@(Get|Post|Put|Patch|Delete)\(\s*(?:['"]([^'"]*)['"])?\s*\)/g;
    let mMatch;
    while ((mMatch = methodRegex.exec(classBody)) !== null) {
      const method = mMatch[1].toUpperCase();
      const subPath = (mMatch[2] || '').trim();

      let fullPath = '';
      if (prefix.startsWith('/api/v1') || prefix.startsWith('api/v1')) {
        fullPath = prefix.startsWith('/') ? prefix : `/${prefix}`;
      } else {
        fullPath = `/api/v1/${prefix}`;
      }
      if (subPath) fullPath += `/${subPath}`;

      // Normalize path slashes: /api/v1/auth//me -> /api/v1/auth/me
      fullPath = fullPath.replace(/\/+/g, '/').replace(/\/$/, '');
      if (fullPath === '/api/v1') fullPath = '/api/v1/';

      endpoints.push({
        method,
        path: fullPath,
      });
    }
  }

  return endpoints;
}

export function parseErdDoc(content) {
  const tables = new Map();
  const lines = content.split('\n');

  let currentTable = null;
  let isPlanned = false;
  let inColumnsTable = false;

  for (const rawLine of lines) {
    const line = rawLine.trim();
    // Khop `### users`, `### Bang users`, va `### gates va event_staff`
    // Phai ket thuc boi het dong hoac mo ngoac vuong [PLANNED] hoac dau hai cham, de khong khop nham tieu de tieng Viet nhu `### Giu cho`
    const tableHeaderMatch = line.match(/^###\s*(?:(?:Bảng|bang)\s+)?([a-zA-Z0-9_]+(?:\s+và\s+[a-zA-Z0-9_]+)?)\s*($|\[|:|\()/i);
    if (tableHeaderMatch) {
      const headerNames = tableHeaderMatch[1].toLowerCase().split(/\s+và\s+/);
      const restOfHeader = tableHeaderMatch[2];
      isPlanned = /\[PLANNED\]|\[Dự kiến\]|\[DỰ KIẾN\]/i.test(restOfHeader) || /\[PLANNED\]|\[Dự kiến\]|\[DỰ KIẾN\]/i.test(line);

      for (const tName of headerNames) {
        const cleanedName = tName.trim();
        // Chi nhan ten bang la identifier hop le (chu thuong, so, gach duoi)
        if (!/^[a-z0-9_]+$/.test(cleanedName)) continue;

        currentTable = {
          name: cleanedName,
          isPlanned,
          columns: [],
        };
        tables.set(cleanedName, currentTable);
      }
      inColumnsTable = false;
      continue;
    }

    if (currentTable) {
      if (line.includes('| Tên cột |') || line.includes('| Tên trường |') || line.includes('| Column |')) {
        inColumnsTable = true;
        continue;
      }
      if (inColumnsTable && line.startsWith('|')) {
        const parts = line.split('|').map((p) => p.trim()).filter(Boolean);
        if (parts.length >= 2 && !parts[0].includes('---')) {
          const colName = parts[0].replace(/[`*]/g, '');
          if (colName) currentTable.columns.push(colName);
        }
      }
      if (line.startsWith('## ') || (line.startsWith('### ') && !tableHeaderMatch)) {
        inColumnsTable = false;
        currentTable = null;
      }
    }
  }

  return tables;
}

export function parseApiContractDoc(content) {
  const endpoints = [];
  const lines = content.split('\n');

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const match = line.match(/(GET|POST|PUT|PATCH|DELETE)\s+(`?\/api\/v1\/[a-zA-Z0-9_/:{}-]+`?)/i);
    if (match) {
      const method = match[1].toUpperCase();
      let pathStr = match[2].replace(/[`]/g, '').trim();
      pathStr = pathStr.replace(/\/+/g, '/').replace(/\/$/, '');
      if (pathStr === '/api/v1') pathStr = '/api/v1/';

      // Kiem tra xem endpoint co nhan [PLANNED] o dong nay hoac tieu de khong
      const isPlanned = /\[PLANNED\]|\[Dự kiến\]|\[DỰ KIẾN\]/i.test(line) ||
        (i > 0 && /\[PLANNED\]|\[Dự kiến\]|\[DỰ KIẾN\]/i.test(lines[i - 1]));

      endpoints.push({
        method,
        path: pathStr,
        isPlanned,
      });
    }
  }

  return endpoints;
}

function normalizeRoutePattern(routePath) {
  // Chuyen :id hoac {id} thanh wildcard de doi chieu linh hoat
  return routePath
    .replace(/:[a-zA-Z0-9_]+/g, ':param')
    .replace(/\{[a-zA-Z0-9_]+\}/g, ':param');
}

export function auditDocParity({
  schemaDir,
  controllersDir,
  erdPath,
  apiContractPath,
  schemaSources,
  controllerSources,
  erdContent,
  apiContractContent,
}) {
  const tableMismatches = [];
  const endpointMismatches = [];
  const warnings = [];

  // 1. Thu thap Schema
  const codeTables = [];
  if (schemaSources) {
    for (const src of schemaSources) {
      codeTables.push(...parseSchemaTables(src.content));
    }
  } else if (schemaDir) {
    const files = findFiles(schemaDir, /\.ts$/).filter((f) => !f.endsWith('index.ts') && !f.endsWith('relations.ts'));
    for (const file of files) {
      const content = fs.readFileSync(file, 'utf8');
      codeTables.push(...parseSchemaTables(content));
    }
  }

  // 2. Thu thap Controllers
  const codeEndpoints = [];
  if (controllerSources) {
    for (const src of controllerSources) {
      codeEndpoints.push(...parseControllerEndpoints(src.content));
    }
  } else if (controllersDir) {
    const files = findFiles(controllersDir, /\.controller\.ts$/);
    for (const file of files) {
      const content = fs.readFileSync(file, 'utf8');
      codeEndpoints.push(...parseControllerEndpoints(content));
    }
  }

  // 3. Doc ERD
  const erdDocContent = erdContent ?? (erdPath && fs.existsSync(erdPath) ? fs.readFileSync(erdPath, 'utf8') : '');
  const docTables = parseErdDoc(erdDocContent);

  // 4. Doc API Contract
  const apiDocContent = apiContractContent ?? (apiContractPath && fs.existsSync(apiContractPath) ? fs.readFileSync(apiContractPath, 'utf8') : '');
  const docEndpoints = parseApiContractDoc(apiDocContent);

  // Đối soát Bảng Database
  for (const table of codeTables) {
    const docTable = docTables.get(table.name.toLowerCase());
    if (!docTable) {
      tableMismatches.push({
        table: table.name,
        reason: `Bảng "${table.name}" có trong Drizzle schema nhưng thiếu trong docs/ERD.md.`,
      });
    }
  }

  for (const [docTableName, docTable] of docTables.entries()) {
    if (docTable.isPlanned) continue;
    const existsInCode = codeTables.some((t) => t.name.toLowerCase() === docTableName);
    if (!existsInCode) {
      tableMismatches.push({
        table: docTableName,
        reason: `Bảng "${docTableName}" có trong docs/ERD.md nhưng chưa có trong code (cần thêm nhãn [PLANNED] nếu là tính năng tương lai).`,
      });
    }
  }

  // Đối soát Endpoints
  for (const codeEp of codeEndpoints) {
    const normCode = normalizeRoutePattern(codeEp.path);
    const matched = docEndpoints.some(
      (docEp) => docEp.method === codeEp.method && normalizeRoutePattern(docEp.path) === normCode
    );

    if (!matched) {
      endpointMismatches.push({
        method: codeEp.method,
        path: codeEp.path,
        reason: `Endpoint ${codeEp.method} ${codeEp.path} có trong Controller nhưng thiếu trong docs/API_CONTRACT.md.`,
      });
    }
  }

  for (const docEp of docEndpoints) {
    if (docEp.isPlanned) continue;
    const normDoc = normalizeRoutePattern(docEp.path);
    const matched = codeEndpoints.some(
      (codeEp) => codeEp.method === docEp.method && normalizeRoutePattern(codeEp.path) === normDoc
    );

    if (!matched) {
      endpointMismatches.push({
        method: docEp.method,
        path: docEp.path,
        reason: `Endpoint ${docEp.method} ${docEp.path} có trong docs/API_CONTRACT.md nhưng chưa có Controller (cần thêm nhãn [PLANNED] nếu là tính năng tương lai).`,
      });
    }
  }

  return {
    valid: tableMismatches.length === 0 && endpointMismatches.length === 0,
    tableMismatches,
    endpointMismatches,
    warnings,
  };
}

// Chạy trực tiếp qua CLI
if (process.argv[1] && process.argv[1].endsWith('audit-doc-parity.mjs')) {
  const repoRoot = process.cwd();
  const schemaDir = path.join(repoRoot, 'apps/api/src/database/schema');
  const controllersDir = path.join(repoRoot, 'apps/api/src');
  const erdPath = path.join(repoRoot, 'docs/ERD.md');
  const apiContractPath = path.join(repoRoot, 'docs/API_CONTRACT.md');

  console.log('--- Đang đối soát tính đồng bộ giữa Mã nguồn và Tài liệu ---');
  const result = auditDocParity({ schemaDir, controllersDir, erdPath, apiContractPath });

  if (result.valid) {
    console.log('✓ XÁC NHẬN: Mã nguồn và Tài liệu đồng bộ hoàn toàn 100%!');
    process.exit(0);
  } else {
    console.error(`✗ PHÁT HIỆN LỆCH HỢP ĐỒNG:`);
    if (result.tableMismatches.length > 0) {
      console.error('\n[Lệch Bảng Database / ERD]:');
      for (const t of result.tableMismatches) {
        console.error(`  - ${t.reason}`);
      }
    }
    if (result.endpointMismatches.length > 0) {
      console.error('\n[Lệch API Endpoints / API Contract]:');
      for (const e of result.endpointMismatches) {
        console.error(`  - ${e.reason}`);
      }
    }
    process.exit(1);
  }
}
