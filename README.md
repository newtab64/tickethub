# TicketHub

TicketHub là nền tảng bán và quản lý vé sự kiện trực tuyến tại Việt Nam. Hệ thống hỗ trợ người mua theo dõi sơ đồ chỗ ngồi trực quan, tự động phân bổ ghế liền kề thông minh (Auto Seat Allocation), thanh toán qua VNPay, nhận vé điện tử mã QR động và hỗ trợ ban tổ chức soát vé tại cổng.

## Yêu cầu môi trường

- Node.js 22 LTS trở lên
- pnpm 9 trở lên
- Docker và Docker Compose

## Khởi chạy môi trường phát triển

1. Khởi động PostgreSQL và Redis:

```bash
docker compose up -d
```

2. Cài đặt các gói phụ thuộc:

```bash
pnpm install
```

3. Thiết lập biến môi trường:

```bash
cp apps/api/.env.example apps/api/.env
```

4. Chạy migration và nạp dữ liệu khởi tạo:

```bash
pnpm --filter @tickethub/api db:migrate
pnpm --filter @tickethub/api db:seed
```

5. Khởi động ứng dụng ở chế độ phát triển:

```bash
pnpm dev
```

- Giao diện web: `http://localhost:3000`
- API backend: `http://localhost:4000`
- Kiểm tra trạng thái API: `http://localhost:4000/health`

## Cấu trúc thư mục

```
tickethub/
├── apps/
│   ├── api/          # Dịch vụ backend dùng NestJS và Fastify, tổ chức theo DDD
│   │   └── src/
│   │       ├── contexts/       # 12 bounded context: identity, event, venue, search, upload,
│   │       │                   # booking, payment, refund, ticketing, moderation, payout, notification
│   │       ├── shared-kernel/  # Hàm thuần dùng chung giữa các context
│   │       ├── database/       # Schema Drizzle, kết nối PostgreSQL và Redis, migration, seed
│   │       └── config/         # Cấu hình môi trường
│   └── web/          # Ứng dụng web dùng Next.js App Router, tổ chức theo tính năng
│       └── src/
│           ├── app/        # Route mỏng, chỉ ghép nối
│           ├── features/   # identity, event, booking, payment, ticketing,
│           │               # organizer, moderation, venue (domain, api, data, ui)
│           └── shared/     # api client, UI nền tảng, định dạng
├── packages/
│   └── shared/       # Mã dùng chung giữa client và server (schema Zod, type)
├── docs/             # Tài liệu đặc tả kỹ thuật
└── docker-compose.yml # Cấu hình PostgreSQL 16 và Redis cục bộ
```

## Cấu hình

Các biến môi trường cần thiết được khai báo trong tệp `.env.example` của từng ứng dụng:

- `apps/api/.env`: kết nối cơ sở dữ liệu (`DATABASE_URL`), Redis (`REDIS_URL`), khóa bí mật JWT, cấu hình cổng VNPay và khóa riêng ký QR Ed25519.
- `apps/web`: không có tệp `.env.example`; đặt biến môi trường `NEXT_PUBLIC_API_URL` khi cần đổi địa chỉ API backend (mặc định `http://localhost:4000/api/v1`).

## Tài liệu liên quan

- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md): Kiến trúc tổng thể, bản đồ bounded context của backend và các luồng xử lý chính.
- [docs/ERD.md](docs/ERD.md): Thiết kế cơ sở dữ liệu và các ràng buộc dữ liệu.
- [docs/API_CONTRACT.md](docs/API_CONTRACT.md): Đặc tả chi tiết các endpoint API.
- [docs/DEVELOPMENT_STANDARDS.md](docs/DEVELOPMENT_STANDARDS.md): Tiêu chuẩn phát triển và kỹ thuật hệ thống.
- [docs/AI_CONTRACT.md](docs/AI_CONTRACT.md): Đặc tả dịch vụ AI hỗ trợ người dùng và hợp đồng giao tiếp API.
- [CONTRIBUTING.md](CONTRIBUTING.md): Hướng dẫn đóng góp mã nguồn và quy trình làm việc.
- [SECURITY.md](SECURITY.md): Chính sách bảo mật và quy trình báo cáo lỗ hổng.

## Giấy phép

Dự án được phát hành theo giấy phép mã nguồn mở [GNU Affero General Public License v3.0 (AGPL-3.0)](LICENSE).
