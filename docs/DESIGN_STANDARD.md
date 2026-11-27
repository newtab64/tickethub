# Chuẩn giao diện

Giao diện `apps/web` cần đơn giản, chuyên nghiệp và lấy người dùng làm trung tâm. Giá trị màu, bo góc và bóng đổ nằm ở [DESIGN_TOKENS.md](DESIGN_TOKENS.md).

## Phạm vi

Áp dụng cho trang làm mới. Trang cũ (gồm trang thanh toán) đưa về chuẩn ở công việc riêng. Header giữ nguyên kiểu.

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

Ngoại lệ: logo dùng độ đậm 800.
