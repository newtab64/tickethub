## 1. Loại thay đổi (PR Type)

Đánh dấu vào loại thay đổi tương ứng:

- [ ] `feat`: Tính năng mới
- [ ] `fix`: Sửa lỗi hệ thống
- [ ] `docs`: Cập nhật tài liệu
- [ ] `refactor`: Tái cấu trúc mã nguồn (không thay đổi hành vi)
- [ ] `chore`: Cấu hình công cụ, nâng cấp thư viện, tác vụ bảo trì

## 2. Kiểm tra kỹ thuật trước khi gửi (Pre-flight Checks)

Bắt buộc thực thi và tích chọn toàn bộ các bước sau tại môi trường cục bộ:

- [ ] Đã chạy `pnpm typecheck` và không có lỗi TypeScript
- [ ] Đã chạy `pnpm lint` và không có lỗi vi phạm quy tắc lint
- [ ] Đã chạy `pnpm format:check` và mã nguồn đã được định dạng nhất quán
- [ ] Đã chạy `pnpm test` và tất cả các bài kiểm thử đều vượt qua (PASS)

## 3. Cam kết chất lượng mã nguồn (Code Quality Guarantees)

Bắt buộc xác nhận toàn bộ các cam kết dưới đây:

- [ ] Không chứa mã giả lập ở client (không dùng localStorage hoặc mock để thay thế API backend)
- [ ] Không sử dụng kiểu `any` (dùng schema Zod hoặc kiểu `unknown` có kiểm tra kiểu)
- [ ] Tuân thủ token màu tại `docs/DESIGN_TOKENS.md` (không dùng mã hex thô không khai báo)
- [ ] Không chứa biểu tượng cảm xúc (emoji) trong commit message và nội dung trao đổi
- [ ] Không chứa ký tự gạch ngang dài (em-dash) trong commit message và nội dung
- [ ] Không can thiệp trái phép vào hạ tầng kiểm soát (không sửa đổi .github/workflows/, scripts/pr-gate-_, scripts/audit-doc-_, tests/pr-gate-*)

## 4. Danh sách ca kiểm thử (Test Cases)

Miêu tả các ca kiểm thử đã thực hiện để chứng minh tính đúng đắn của thay đổi:

- Ca kiểm thử 1: [Mô tả ca kiểm thử và kết quả]
- Ca kiểm thử 2: [Mô tả ca kiểm thử và kết quả]

## 5. Ghi chú bổ sung (Additional Notes)

[Nếu có bất kỳ lưu ý kiến trúc nào, hãy ghi tại đây]

## 6. Minh chứng trực quan (Visual Evidence)

Bắt buộc đính kèm ít nhất 1 hình ảnh hoặc video minh chứng nếu PR có thay đổi giao diện người dùng (UI/UX) tại `apps/web`:

<!-- Dán ảnh chụp màn hình hoặc liên kết video (Loom, YouTube, Drive, MP4) tại đây -->
<!-- Nếu PR chỉ sửa Backend hoặc Logic không có giao diện hiển thị, ghi rõ: N/A - Không có thay đổi giao diện -->
