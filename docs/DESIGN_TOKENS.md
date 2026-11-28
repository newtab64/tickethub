# Design tokens

Tài liệu này là nguồn tham chiếu duy nhất cho ngôn ngữ thiết kế của `apps/web`. Các giá trị bên dưới phản ánh đúng những gì đang chạy trong [`globals.css`](../apps/web/src/app/globals.css) và các component hiện có.

Nguyên tắc chung: mặc định nền trắng, viền mảnh, ít đổ bóng, một màu nhấn chàm (indigo); xanh lục chỉ dùng cho nghĩa thành công. Trang thanh toán là ngoại lệ: nền xám lạnh, thẻ trắng có bóng mềm và thêm màu theo ngữ cảnh. Mọi hình ảnh sự kiện là ảnh thật, không dùng minh họa vẽ tay.

Quy tắc trình bày chung nằm ở [DESIGN_STANDARD.md](DESIGN_STANDARD.md).

## 1. Màu sắc

### Token ngữ nghĩa (khai báo trong `:root`)

| Token                  | Giá trị   | Dùng cho                                  |
| :--------------------- | :-------- | :---------------------------------------- |
| `--primary`            | `#4338ca` | Nút chính, liên kết, trạng thái đang chọn |
| `--primary-foreground` | `#ffffff` | Chữ trên nền `--primary`                  |
| `--ring`               | `#6366f1` | Vòng focus                                |
| `--accent`             | `#eef2ff` | Nền nhấn nhẹ                              |
| `--accent-foreground`  | `#3730a3` | Chữ trên nền `--accent`                   |
| `--background`         | `#ffffff` | Nền trang                                 |
| `--foreground`         | `#141d23` | Chữ chính                                 |
| `--muted`              | `#f5f7f8` | Nền khu vực phụ                           |
| `--muted-foreground`   | `#606970` | Chữ phụ (ngày, mô tả)                     |
| `--secondary`          | `#eff1f2` | Nền ảnh chờ tải, nút phụ                  |
| `--surface-dark`       | `#0c141a` | Nền tối của hero và banner sự kiện        |
| `--border` / `--input` | `#dfe3e5` | Viền, đường kẻ, ô nhập                    |
| `--destructive`        | `#d51b34` | Lỗi, hành động nguy hiểm                  |
| `--venue-stage`        | `#334155` | Nền sân khấu trong sơ đồ                  |
| `--venue-pitch`        | `#4ade80` | Mặt sân bóng trong sơ đồ sân vận động     |
| `--venue-pitch-stroke` | `#22c55e` | Viền sân bóng trong sơ đồ sân vận động    |
| `--primary-strong`     | `#3730a3` | Rê chuột trên nút chính                   |
| `--checkout-page`      | `#e4e9ec` | Nền trang thanh toán                      |
| `--checkout-border`    | `#c9d2d8` | Đường kẻ chân trang thanh toán            |
| `--warning`            | `#9a3412` | Chữ đồng hồ và nhãn cảnh báo              |
| `--warning-soft`       | `#fff7ed` | Nền nhãn cảnh báo                         |
| `--warning-ring`       | `#ea580c` | Vòng tiến độ khi sắp hết hạn              |
| `--success`            | `#047857` | Chữ và biểu tượng báo thành công, còn vé  |
| `--success-soft`       | `#ecfdf5` | Nền thông báo thành công                  |
| `--success-border`     | `#a7f3d0` | Viền thông báo thành công                 |
| `--fill`               | `#e1e4e8` | Nền nút phụ trên header và dòng thu gọn   |
| `--fill-hover`         | `#d0d5db` | Nền nút phụ khi rê chuột                  |
| `--field`              | `#eceef1` | Nền ô nhập, ô chọn và ô ngày giờ          |

Bóng đổ (khai báo trong `@theme inline`): `--shadow-sheet` cho header, thẻ và thanh thanh toán nổi.

### Màu theo ngữ cảnh ở trang thanh toán

Mỗi màu gắn với một ý nghĩa, không dùng để trang trí.

| Ngữ cảnh           | Màu                                                                    |
| :----------------- | :--------------------------------------------------------------------- |
| Hành động chính    | `--primary`, là nút chàm duy nhất trong thẻ                            |
| Đồng hồ giữ chỗ    | Trung tính; nhóm `--warning` từ 120 giây; `--destructive` dưới 60 giây |
| Hủy giao dịch      | Nút xám `--fill`; trong hộp thoại xác nhận là chữ `--destructive`      |
| Thanh trả tiền nổi | Nền `--foreground`, chữ `--background`, nút chính chàm                 |

Viền focus là một nét 2px theo `--ring`, bo theo khung; không ghép viền với bóng đổ.

### Giá trị thô đang dùng trực tiếp trong JSX

Một số giá trị chưa có token và đang được ghi thẳng dưới dạng `[#hex]`:

| Giá trị   | Số lần dùng | Tương ứng token                                    |
| :-------- | :---------: | :------------------------------------------------- |
| `#141d23` |     38      | `--foreground`                                     |
| `#606970` |     17      | `--muted-foreground`                               |
| `#dfe3e5` |     16      | `--border`                                         |
| `#2b343a` |      6      | Chưa có (chữ liên kết ở footer, nút tối khi hover) |
| `#f5f7f8` |      4      | `--muted`                                          |
| `#eff1f2` |      3      | `--secondary`                                      |
| `#868f97` |      2      | Chưa có (viền khi hover nút lọc)                   |
| `#e2e6e8` |      1      | Chưa có (viền thanh tìm kiếm)                      |

Quy ước cho code mới: dùng class theo token (`text-foreground`, `text-muted-foreground`, `border-border`, `bg-muted`, `bg-primary`) thay vì `[#hex]`. Với giá trị chưa có token, thêm token vào `globals.css` trước khi dùng.

## 2. Typography

| Mục                | Giá trị                                              |
| :----------------- | :--------------------------------------------------- |
| Font chữ           | Inter (`--font-sans`), có tiếng Việt                 |
| Số và mã           | Inter với `tabular-nums` cho đồng hồ, số ghế, mã đơn |
| Letter-spacing nền | `-0.005em`                                           |

Trang và thành phần đã đưa về [chuẩn giao diện](DESIGN_STANDARD.md) chỉ dùng 28, 17, 15 và 13px với hai độ đậm. Bảng dưới còn áp dụng cho các trang chưa làm mới:

| Cỡ             | Vai trò                         |
| :------------- | :------------------------------ |
| 24px / 800     | Tiêu đề trang (`Vé của tôi`)    |
| 19px / 700     | Tiêu đề mục (`Sự kiện nổi bật`) |
| 17px / 700     | Tiêu đề thẻ lớn                 |
| 14px / 700     | Tên sự kiện, giá trong thẻ lưới |
| 13px / 500-600 | Nút, nhãn lọc, liên kết         |
| 12px           | Ngày giờ, chữ phụ               |
| 11px           | Nhãn viết hoa nhỏ               |

## 3. Bo góc

| Bán kính        | Dùng cho                                    |
| :-------------- | :------------------------------------------ |
| `9999px` (full) | Thanh tìm kiếm, huy hiệu trạng thái, avatar |
| `16px`          | Ảnh sự kiện, thẻ sự kiện nổi bật            |
| `14px`          | Thẻ danh mục                                |
| `12px`          | Khung thông báo, vé                         |
| `10px`          | Logo, ảnh nhỏ                               |
| `8px`           | Nút lọc, nút thao tác                       |

Token Tailwind tương ứng: `--radius-sm` 6px, `--radius-md` 8px, `--radius-lg` 12px, `--radius-xl` 16px, `--radius-2xl` 24px.

## 4. Khoảng cách và bố cục

| Mục                             | Giá trị                                      |
| :------------------------------ | :------------------------------------------- |
| Chiều rộng nội dung tối đa      | `1200px`, căn giữa                           |
| Padding ngang trang             | `16px` (mobile), `24px` (từ `sm`)            |
| Khoảng cách giữa các mục        | `48px` (`space-y-12`)                        |
| Khoảng cách giữa thẻ trong lưới | `16px`                                       |
| Lưới thẻ                        | 2 cột (mobile), 4 cột (từ `sm`)              |
| Thẻ nổi bật                     | Tỉ lệ `286/352`, 1 / 2 / 4 cột theo màn hình |
| Ảnh thẻ lưới                    | Tỉ lệ `5/4`                                  |

## 5. Thành phần

### Thẻ sự kiện (lưới)

Ảnh `5/4` bo `16px`, biểu tượng yêu thích ở góc trên phải (nền tối 38% + viền trắng, không có vòng tròn), dưới ảnh là ba dòng: tên (14px đậm), ngày (12px, `--muted-foreground`), giá "từ" (14px đậm, màu chữ chính, không dùng màu xanh).

### Thẻ sự kiện nổi bật

Ảnh phủ kín tỉ lệ `286/352`, lớp phủ gradient đen từ dưới, tên (17px đậm, tối đa 2 dòng) và ngày nằm góc dưới trái, màu trắng. Không có huy hiệu hay số thứ hạng.

### Nút lọc

Cao `36px`, bo `8px`. Mặc định: viền `--border`, nền trắng. Đang chọn: viền `1.5px` `--primary`, nền `accent/50`, chữ `--primary`, đậm hơn.

### Thành phần chung

| Thành phần                                | Quy cách                                                                                                                                            |
| :---------------------------------------- | :-------------------------------------------------------------------------------------------------------------------------------------------------- |
| `Button`                                  | Viên thuốc, 15px đậm, cao 44px (`lg` 48px). Chính: `--primary`, rê chuột `--primary-strong`. Phụ và viền: `--fill`. Nguy hiểm: chữ `--destructive`. |
| `Input`, nút mở danh sách chọn, ngày, giờ | Viên thuốc cao 48px, nền `--field`, không viền; focus viền `--primary` 2px, lỗi viền `--destructive` 2px.                                           |
| `Card`                                    | Bo 24px, không viền, bóng `--shadow-sheet`.                                                                                                         |
| `Dialog`                                  | Bo 24px, nút đóng tròn 44px, tắt hiệu ứng khi giảm chuyển động.                                                                                     |
| `Badge`                                   | Viên thuốc 13px đậm: `success`, `warning`, `destructive`, `neutral`.                                                                                |

Nền `--field` chênh với nền trắng khoảng 1.15:1, thấp hơn mức 3:1 cho đường bao điều khiển; đây là lựa chọn thiết kế đã duyệt.

### Trạng thái focus

Vòng `--ring` (`#6366f1`) bán trong suốt, áp dụng qua `outline-ring/50` và `focus-visible:ring`.

## 6. Trạng thái và Sơ đồ ghế (SeatMap)

Sơ đồ ghế SVG đóng vai trò hiển thị trực quan cấu trúc khu vực, hàng ghế và số lượng ghế khả dụng của sự kiện. Nền tảng áp dụng cơ chế tự động phân bổ ghế liền kề (Auto Seat Allocation) theo hạng vé khi người mua đặt chỗ, không yêu cầu người mua phải bấm chọn từng vị trí ghế thủ công:

| Trạng thái  | Nền            | Viền       | Ghi chú                                      |
| :---------- | :------------- | :--------- | :------------------------------------------- |
| `AVAILABLE` | `--background` | `--border` | Ghế còn trống, sẵn sàng cho hệ thống phân bổ |
| `HELD`      | `--secondary`  | `--border` | Ghế đang trong phiên giữ chỗ 5 phút          |
| `SOLD`      | `--muted`      | `--muted`  | Ghế đã thanh toán xuất vé thành công         |

Khi đặt chỗ thành công, giao diện hiển thị danh sách các ghế được cấp tự động (ví dụ: `Hàng A - Ghế 01, Hàng A - Ghế 02`) trên banner đếm ngược thời gian giữ chỗ.

## 7. Việc còn lại

- Chuyển các `[#hex]` ở bảng mục 1 sang token, và thêm token cho `#2b343a`, `#868f97`, `#e2e6e8`, `#0c141a`.
- Chưa có chế độ tối. Biến thể `dark` đã được khai báo trong `globals.css` nhưng chưa có giá trị.
- Hoàn thiện thiết kế chi tiết luồng cổng thanh toán VNPay và vé điện tử QR.
