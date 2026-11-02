import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { auditDocParity } from '../scripts/audit-doc-parity.mjs';

describe('auditDocParity', () => {
  it('passes when schemas and endpoints match documentation exactly', () => {
    const mockSchema = `
      export const users = pgTable('users', {
        id: uuid('id').primaryKey(),
        email: text('email').notNull(),
        fullName: text('full_name').notNull(),
      });
    `;

    const mockController = `
      @Controller('auth')
      export class AuthController {
        @Post('login')
        async login() {}

        @Get('me')
        async me() {}
      }
    `;

    const mockErd = `
      ### Bảng users
      | Tên cột | Kiểu dữ liệu | Mô tả |
      | :--- | :--- | :--- |
      | id | uuid | Khóa chính |
      | email | text | Địa chỉ email |
      | full_name | text | Họ và tên |
    `;

    const mockApiContract = `
      ### POST /api/v1/auth/login
      Đăng nhập tài khoản.

      ### GET /api/v1/auth/me
      Lấy thông tin người dùng hiện tại.
    `;

    const result = auditDocParity({
      schemaSources: [{ file: 'users.ts', content: mockSchema }],
      controllerSources: [{ file: 'auth.controller.ts', content: mockController }],
      erdContent: mockErd,
      apiContractContent: mockApiContract,
    });

    assert.equal(result.valid, true);
    assert.deepEqual(result.tableMismatches, []);
    assert.deepEqual(result.endpointMismatches, []);
  });

  it('fails when controller endpoint is missing from documentation', () => {
    const mockController = `
      @Controller('auth')
      export class AuthController {
        @Post('reset-password')
        async resetPassword() {}
      }
    `;

    const result = auditDocParity({
      schemaSources: [],
      controllerSources: [{ file: 'auth.controller.ts', content: mockController }],
      erdContent: '',
      apiContractContent: '### POST /api/v1/auth/login',
    });

    assert.equal(result.valid, false);
    assert.ok(result.endpointMismatches.some((e) => e.path.includes('reset-password')));
  });

  it('ignores planned endpoints marked with [PLANNED]', () => {
    const mockApiContract = `
      ### [PLANNED] GET /api/v1/venues
      Lấy danh sách địa điểm (tính năng dự kiến).
    `;

    const result = auditDocParity({
      schemaSources: [],
      controllerSources: [],
      erdContent: '',
      apiContractContent: mockApiContract,
    });

    assert.equal(result.valid, true);
    assert.deepEqual(result.endpointMismatches, []);
  });

  it('fails when database table is missing from ERD document', () => {
    const mockSchema = `
      export const gates = pgTable('gates', {
        id: uuid('id').primaryKey(),
        name: text('name').notNull(),
      });
    `;

    const result = auditDocParity({
      schemaSources: [{ file: 'gates.ts', content: mockSchema }],
      controllerSources: [],
      erdContent: '### Bảng users',
      apiContractContent: '',
    });

    assert.equal(result.valid, false);
    assert.ok(result.tableMismatches.some((t) => t.table === 'gates'));
  });

  it('ignores planned tables in ERD marked with [PLANNED]', () => {
    const mockErd = `
      ### Bảng venues [PLANNED]
      | Tên cột | Kiểu dữ liệu |
      | id | uuid |
    `;

    const result = auditDocParity({
      schemaSources: [],
      controllerSources: [],
      erdContent: mockErd,
      apiContractContent: '',
    });

    assert.equal(result.valid, true);
    assert.deepEqual(result.tableMismatches, []);
  });
});
