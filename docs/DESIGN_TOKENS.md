# Design tokens

Tài liệu này là nguồn tham chiếu duy nhất cho ngôn ngữ thiết kế của `apps/web`. Các giá trị bên dưới phản ánh đúng những gì đang chạy trong [`globals.css`](../apps/web/src/app/globals.css) và các component hiện có.

Nguyên tắc chung: nền trắng, viền mảnh, ít đổ bóng, một màu nhấn xanh lục (emerald). Mọi hình ảnh sự kiện là ảnh thật, không dùng minh họa vẽ tay.

## 1. Màu sắc

### Token ngữ nghĩa (khai báo trong `:root`)

| Token | Giá trị | Dùng cho |
| :--- | :--- | :--- |
| `--primary` | `#059669` | Nút chính, liên kết, trạng thái đang chọn |
| `--primary-foreground` | `#ffffff` | Chữ trên nền `--primary` |
| `--ring` | `#10b981` | Vòng focus |
| `--accent` | `#ecfdf5` | Nền nhấn nhẹ (emerald-50) |
| `--accent-foreground` | `#065f46` | Chữ trên nền `--accent` |
| `--background` | `#ffffff` | Nền trang |
| `--foreground` | `#141d23` | Chữ chính |
| `--muted` | `#f5f7f8` | Nền khu vực phụ |
| `--muted-foreground` | `#606970` | Chữ phụ (ngày, mô tả) |
| `--secondary` | `#eff1f2` | Nền ảnh chờ tải, nút phụ |
| `--border` / `--input` | `#dfe3e5` | Viền, đường kẻ, ô nhập |
| `--destructive` | `#d51b34` | Lỗi, hành động nguy hiểm |
| `--venue-stage` | `#334155` | Nền sân khấu trong sơ đồ |
| `--venue-pitch` | `#4ade80` | Mặt sân bóng trong sơ đồ sân vận động |
| `--venue-pitch-stroke` | `#22c55e` | Viền sân bóng trong sơ đồ sân vận động |

### Giá trị thô đang dùng trực tiếp trong JSX

Một số giá trị chưa có token và đang được ghi thẳng dưới dạng `[#hex]`:

| Giá trị | Số lần dùng | Tương ứng token |
| :--- | :---: | :--- |
| `#141d23` | 38 | `--foreground` |
| `#606970` | 17 | `--muted-foreground` |
| `#dfe3e5` | 16 | `--border` |
| `#2b343a` | 6 | Chưa có (chữ liên kết ở footer, nút tối khi hover) |
| `#f5f7f8` | 4 | `--muted` |
| `#eff1f2` | 3 | `--secondary` |
| `#868f97` | 2 | Chưa có (viền khi hover nút lọc) |
| `#e2e6e8` | 1 | Chưa có (viền thanh tìm kiếm) |
| `#0c141a` | 1 | Chưa có (thanh thông báo trên cùng) |

Quy ước cho code mới: dùng class theo token (`text-foreground`, `text-muted-foreground`, `border-border`, `bg-muted`, `bg-primary`) thay vì `[#hex]`. Với giá trị chưa có token, thêm token vào `globals.css` trước khi dùng.

## 2. Typography

| Mục | Giá trị |
| :--- | :--- |
| Font chữ | Inter (`--font-sans`), có tiếng Việt |
| Font số/mã | JetBrains Mono (`--font-mono`), dùng cho mã đơn, số ghế |
| Letter-spacing nền | `-0.005em` |

Thang cỡ chữ đang dùng:

| Cỡ | Vai trò |
| :--- | :--- |
| 24px / 800 | Tiêu đề trang (`Vé của tôi`) |
| 19px / 700 | Tiêu đề mục (`Sự kiện nổi bật`) |
| 17px / 700 | Tiêu đề thẻ lớn |
| 14px / 700 | Tên sự kiện, giá trong thẻ lưới |
| 13px / 500-600 | Nút, nhãn lọc, liên kết |
| 12px | Ngày giờ, chữ phụ |
| 11px | Nhãn viết hoa nhỏ |

## 3. Bo góc

| Bán kính | Dùng cho |
| :--- | :--- |
| `9999px` (full) | Thanh tìm kiếm, huy hiệu trạng thái, avatar |
| `16px` | Ảnh sự kiện, thẻ sự kiện nổi bật |
| `14px` | Thẻ danh mục |
| `12px` | Khung thông báo, vé |
| `10px` | Logo, ảnh nhỏ |
| `8px` | Nút lọc, nút thao tác |

Token Tailwind tương ứng: `--radius-sm` 6px, `--radius-md` 8px, `--radius-lg` 12px, `--radius-xl` 16px, `--radius-2xl` 24px.

## 4. Khoảng cách và bố cục

| Mục | Giá trị |
| :--- | :--- |
| Chiều rộng nội dung tối đa | `1200px`, căn giữa |
| Padding ngang trang | `16px` (mobile), `24px` (từ `sm`) |
| Khoảng cách giữa các mục | `48px` (`space-y-12`) |
| Khoảng cách giữa thẻ trong lưới | `16px` |
| Lưới thẻ | 2 cột (mobile), 4 cột (từ `sm`) |
| Thẻ nổi bật | Tỉ lệ `286/352`, 1 / 2 / 4 cột theo màn hình |
| Ảnh thẻ lưới | Tỉ lệ `5/4` |

## 5. Thành phần

### Thẻ sự kiện (lưới)
Ảnh `5/4` bo `16px`, biểu tượng yêu thích ở góc trên phải (nền tối 38% + viền trắng, không có vòng tròn), dưới ảnh là ba dòng: tên (14px đậm), ngày (12px, `--muted-foreground`), giá "từ" (14px đậm, màu chữ chính, không dùng màu xanh).

### Thẻ sự kiện nổi bật
Ảnh phủ kín tỉ lệ `286/352`, lớp phủ gradient đen từ dưới, tên (17px đậm, tối đa 2 dòng) và ngày nằm góc dưới trái, màu trắng. Không có huy hiệu hay số thứ hạng.

### Nút lọc
Cao `36px`, bo `8px`. Mặc định: viền `--border`, nền trắng. Đang chọn: viền `1.5px` `--primary`, nền `emerald-50/50`, chữ `--primary`, đậm hơn.

### Nút chính
Component `Button` mặc định dùng `bg-primary`, hover giảm độ đậm còn 80%. Nút tự dựng ngoài `Button` (logo, nút định vị) dùng `bg-primary` và hover `emerald-700`; nên thống nhất về một kiểu khi có thời gian.

### Trạng thái focus
Vòng `--ring` (`#10b981`) bán trong suốt, áp dụng qua `outline-ring/50` và `focus-visible:ring`.

## 6. Trạng thái và Sơ đồ ghế (SeatMap)

Sơ đồ ghế SVG đóng vai trò hiển thị trực quan cấu trúc khu vực, hàng ghế và số lượng ghế khả dụng của sự kiện. Nền tảng áp dụng cơ chế tự động phân bổ ghế liền kề (Auto Seat Allocation) theo hạng vé khi người mua đặt chỗ, không yêu cầu người mua phải bấm chọn từng vị trí ghế thủ công:

| Trạng thái | Nền | Viền | Ghi chú |
| :--- | :--- | :--- | :--- |
| `AVAILABLE` | `--background` | `--border` | Ghế còn trống, sẵn sàng cho hệ thống phân bổ |
| `HELD` | `--secondary` | `--border` | Ghế đang trong phiên giữ chỗ 5 phút |
| `SOLD` | `--muted` | `--muted` | Ghế đã thanh toán xuất vé thành công |

Khi đặt chỗ thành công, giao diện hiển thị danh sách các ghế được cấp tự động (ví dụ: `Hàng A - Ghế 01, Hàng A - Ghế 02`) trên banner đếm ngược thời gian giữ chỗ.

## 7. Việc còn lại

- Chuyển các `[#hex]` ở bảng mục 1 sang token, và thêm token cho `#2b343a`, `#868f97`, `#e2e6e8`, `#0c141a`.
- Chưa có chế độ tối. Biến thể `dark` đã được khai báo trong `globals.css` nhưng chưa có giá trị.
- Hoàn thiện thiết kế chi tiết luồng cổng thanh toán VNPay và vé điện tử QR.
