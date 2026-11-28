# Chuẩn giao diện

Giao diện `apps/web` cần đơn giản, chuyên nghiệp và lấy người dùng làm trung tâm. Giá trị màu, bo góc và bóng đổ nằm ở [DESIGN_TOKENS.md](DESIGN_TOKENS.md).

## Phạm vi

Áp dụng cho trang làm mới. Trang cũ (gồm trang thanh toán) đưa về chuẩn ở công việc riêng.

## Quy tắc

1. **Một màn hình, một việc.** Đúng một nút chính; việc phụ là dòng chữ.
2. **Chỉ hiện cái cần ngay.** Phần còn lại nằm sau một lần bấm.
3. **Chữ gọn.** Bốn cỡ 28, 17, 15 và 13px; hai độ đậm 400 và 600.
4. **Khoảng thở đều.** Khoảng cách theo bội số 8.
5. **Màu có nghĩa.** Màu nhấn cho hành động chính, `success` cho thành công và còn vé, `warning` cho cảnh báo, `destructive` cho nguy hiểm. Không tô màu trang trí.
6. **Hình khối thống nhất.** Thẻ bo 24px, nút dạng viên thuốc, hạn chế viền và bóng.
7. **Dễ dùng cho mọi người.** Vùng chạm tối thiểu 44px, tương phản đạt AA, chuyển động tối đa 250ms và tắt được khi người dùng giảm chuyển động.
8. **Nói bằng lời người dùng.** Không dùng thuật ngữ kỹ thuật.
9. **Bố cục theo mục đích.** Trang để xem dùng một cột; trang để giao dịch dùng hai cột.
10. **Bấm được thì nhìn ra được.** Dùng nền, viền, gạch chân hoặc mũi tên; phần mở rộng có mũi tên.
11. **Chỉ nút hành động mới có nền.** Liên kết điều hướng là chữ trơn. Nút phụ dùng nền xám `fill` với chữ đen; màu nhấn dành cho một hành động chính.

Ngoại lệ: logo dùng độ đậm 800, cỡ 24px (điện thoại 20px).

## Header chung

Trang công khai, đặt vé, thanh toán và đơn hàng dùng `shared/ui/site-header.tsx`. Góc phải là `HeaderActions` của `features/identity`: "Vé của tôi" chỉ hiện với người mua đã đăng nhập, rồi tới menu tài khoản hoặc nút "Đăng nhập". Tìm kiếm chỉ có ở trang công khai. Trang thanh toán không có "Đăng xuất" trong menu. Cổng Ban tổ chức và Quản trị chưa chuyển.

## Kiểm tra tự động

`apps/web/test/design-standard.test.ts` đọc các file đã đưa về chuẩn (`STANDARD_FILES`): chỉ cỡ chữ 28, 17, 15, 13px, độ đậm 400 và 600, không mã màu hex, không bảng màu Tailwind thô. Làm mới trang nào thì thêm file của trang đó vào danh sách.
