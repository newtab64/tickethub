# TicketHub Web

Ứng dụng giao diện của TicketHub xây dựng bằng Next.js App Router và React. Tổ chức mã theo tính năng; mô tả đầy đủ nằm trong [docs/ARCHITECTURE.md](../../docs/ARCHITECTURE.md) (mục "Kiến trúc frontend theo tính năng").

## Chạy ứng dụng

Từ thư mục gốc của kho mã:

```bash
pnpm --filter @tickethub/web dev     # chế độ phát triển, http://localhost:3000
pnpm --filter @tickethub/web build   # biên dịch bản production
pnpm --filter @tickethub/web start   # chạy bản đã biên dịch
```

Cần Node.js 22 LTS trở lên. Các biến môi trường ứng dụng đọc: `NEXT_PUBLIC_API_URL` (địa chỉ API cho trình duyệt), `API_URL` (địa chỉ API cho proxy giữ chỗ phía máy chủ, mặc định lấy từ `NEXT_PUBLIC_API_URL`) và `JWT_SECRET` (khóa xác thực chữ ký JWT trong `proxy.ts`, phải trùng với backend; có giá trị mặc định chỉ dùng cho phát triển).

## Cấu trúc mã nguồn

```
src/
├── app/                 # Route Next.js: page.tsx, layout.tsx, route handler (chỉ ghép nối)
├── features/<tên>/
│   ├── domain/          # Kiểu và hàm thuần, không phụ thuộc React hay Next
│   ├── api/             # Gọi backend, lưu trữ trình duyệt, xác thực
│   ├── data/            # Dữ liệu tạm cho đến khi có API
│   ├── ui/              # Màn hình, hook use-*-screen và các khối giao diện
│   ├── index.ts         # API công khai của feature
│   └── server.ts        # Điểm vào phía máy chủ (nếu có)
├── shared/              # api client, thành phần UI nền tảng, định dạng
└── proxy.ts             # Bảo vệ route theo vai trò
```

Các feature: `identity`, `event`, `booking`, `payment`, `ticketing`, `organizer`, `moderation`, `venue`.

## Kiểm thử

```bash
pnpm --filter @tickethub/web test       # test đơn vị (node:test), gồm test kiến trúc
pnpm --filter @tickethub/web lint
pnpm --filter @tickethub/web test:e2e   # Playwright, cần backend đang chạy
```

Sơ đồ SVG địa điểm được sinh bằng `python3 apps/web/scripts/build-venue-maps.py` và ghi vào `src/features/venue/data/venue-svg.generated.ts`.
