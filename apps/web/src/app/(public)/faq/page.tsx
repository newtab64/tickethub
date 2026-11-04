"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { ChevronDown, ChevronUp, Search, X } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

interface FaqItem {
  id: string;
  category: "QR_SECURITY" | "REFUND_POLICY" | "WAITING_ROOM" | "LEGAL_PRIVACY";
  question: string;
  answer: string;
}

const FAQ_ITEMS: FaqItem[] = [
  {
    id: "faq-1",
    category: "QR_SECURITY",
    question: "Vì sao mã QR trên vé điện tử tự động thay đổi sau mỗi 30 giây?",
    answer:
      "Mỗi vé điện tử sử dụng mã QR động được ký số và làm mới sau mỗi 30 giây. Khi mã mới được tạo, mã cũ hoặc ảnh chụp màn hình trước đó sẽ hết hiệu lực. Cơ chế này giúp hạn chế việc sao chép ảnh vé hoặc sử dụng lại một vé cho nhiều người.",
  },
  {
    id: "faq-2",
    category: "QR_SECURITY",
    question: "Khi nào mã QR của vé bắt đầu hiển thị trong mục Vé của tôi?",
    answer:
      "Mã QR động được kích hoạt trong khung giờ mở cổng của sự kiện (mặc định từ 2 giờ trước giờ mở cổng cho đến khi kết thúc chương trình). Ngoài khung giờ này, bạn vẫn xem được đầy đủ thông tin đơn hàng, vị trí ghế và trạng thái vé.",
  },
  {
    id: "faq-3",
    category: "QR_SECURITY",
    question:
      "Nếu điện thoại hết pin hoặc mất kết nối mạng tại cổng thì xử lý thế nào?",
    answer:
      "Bạn có thể cung cấp mã vé (hoặc số điện thoại, email đăng ký mua vé) kèm căn cước công dân trùng khớp với thông tin người mua. Nhân viên tại cổng sẽ tra cứu trên hệ thống và xác nhận vào cổng thủ công.",
  },
  {
    id: "faq-4",
    category: "REFUND_POLICY",
    question: "Quy định hủy vé và mức hoàn tiền được tính như thế nào?",
    answer:
      "Tùy theo thời điểm gửi yêu cầu hủy trước ngày diễn ra sự kiện, hệ thống áp dụng mức hoàn tiền theo biểu phí của Ban tổ chức: hủy trước từ 7 ngày trở lên được hoàn 100%; từ 3 đến dưới 7 ngày hoàn 70%; dưới 3 ngày trước sự kiện không hỗ trợ hủy vé. Trường hợp sự kiện bị hủy hoặc dời lịch bởi Ban tổ chức, người mua được hoàn lại 100% giá trị vé.",
  },
  {
    id: "faq-5",
    category: "WAITING_ROOM",
    question: "Cơ chế giữ chỗ 5 phút và hàng chờ khi mở bán hoạt động ra sao?",
    answer:
      "Với sự kiện có lượng truy cập lớn, hệ thống xếp thứ tự vào mua theo thời điểm truy cập. Khi vào màn hình chọn vé, mỗi đơn được chọn tối đa 6 vé và được giữ chỗ riêng trong 5 phút để hoàn tất thanh toán. Nếu quá 5 phút chưa thanh toán, ghế sẽ tự động trả lại hệ thống cho người mua khác.",
  },
  {
    id: "faq-6",
    category: "LEGAL_PRIVACY",
    question:
      "Thông tin cá nhân của người mua và Ban tổ chức được bảo vệ như thế nào?",
    answer:
      "Hệ thống tuân thủ quy định về bảo vệ dữ liệu cá nhân theo Nghị định 13/2023/NĐ-CP. Dữ liệu định danh chỉ phục vụ việc phát hành vé, đối soát vào cổng và xác minh pháp lý của Ban tổ chức. Mật khẩu người dùng được mã hóa một chiều và nhật ký hệ thống không lưu trữ thông tin thẻ thanh toán.",
  },
];

const CATEGORIES = [
  { key: "ALL", label: "Tất cả" },
  { key: "QR_SECURITY", label: "Vé điện tử & Soát vé" },
  { key: "REFUND_POLICY", label: "Hoàn tiền & Hủy vé" },
  { key: "WAITING_ROOM", label: "Giữ chỗ & Hàng chờ" },
  { key: "LEGAL_PRIVACY", label: "Bảo mật & Điều khoản" },
] as const;

export default function LegalAndFaqPage() {
  const [activeCategory, setActiveCategory] = useState<string>("ALL");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [openId, setOpenId] = useState<string>("faq-1");

  const filteredFaqs = useMemo(() => {
    return FAQ_ITEMS.filter((item) => {
      if (activeCategory !== "ALL" && item.category !== activeCategory) {
        return false;
      }
      if (searchQuery.trim() !== "") {
        const q = searchQuery.toLowerCase();
        return (
          item.question.toLowerCase().includes(q) ||
          item.answer.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [activeCategory, searchQuery]);

  return (
    <div className="max-w-[1200px] mx-auto px-4 sm:px-6 py-8 space-y-8">
      {/* 1. Header: Calm & task-oriented */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            Chính sách &amp; Câu hỏi thường gặp
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Quy định sử dụng dịch vụ, chính sách hoàn hủy vé và bảo vệ dữ liệu
            cá nhân trên TicketHub.
          </p>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          <Link
            href="/guide"
            className="inline-flex items-center h-9 px-3.5 rounded-[8px] border border-border bg-background hover:bg-muted text-foreground text-[13px] font-medium transition-colors"
          >
            Hướng dẫn sử dụng
          </Link>
          <Link
            href="/my-tickets"
            className="inline-flex items-center h-9 px-3.5 rounded-[8px] bg-primary hover:bg-emerald-700 text-primary-foreground text-[13px] font-semibold transition-colors"
          >
            Vé của tôi
          </Link>
        </div>
      </div>

      {/* 2. Filter & Search Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border pb-4">
        <div className="flex flex-wrap items-center gap-2">
          {CATEGORIES.map((tab) => {
            const isSelected = activeCategory === tab.key;
            return (
              <button
                key={tab.key}
                type="button"
                onClick={() => setActiveCategory(tab.key)}
                className={`h-9 px-3.5 rounded-[8px] text-[13px] transition-colors cursor-pointer ${
                  isSelected
                    ? "border-[1.5px] border-primary bg-emerald-50/50 text-primary font-semibold"
                    : "border border-border bg-background text-foreground font-medium hover:bg-muted"
                }`}
              >
                {tab.label}
              </button>
            );
          })}
        </div>

        <div className="relative w-full sm:w-72">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Tìm câu hỏi hoặc quy định..."
            className="w-full h-9 pl-9 pr-8 rounded-[8px] border border-border bg-background text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery("")}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground cursor-pointer"
            >
              <X className="size-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* 3. Main Content: 2 Columns */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left: FAQ Accordion List (7 cols) */}
        <div className="lg:col-span-7 space-y-3">
          <h2 className="text-base font-bold text-foreground">
            Câu hỏi thường gặp ({filteredFaqs.length})
          </h2>

          {filteredFaqs.length === 0 ? (
            <div className="py-12 text-center text-xs text-muted-foreground border border-dashed border-border rounded-lg">
              Không tìm thấy câu hỏi phù hợp với từ khóa của bạn.
            </div>
          ) : (
            <div className="divide-y divide-border rounded-lg border border-border bg-background">
              {filteredFaqs.map((item) => {
                const isOpen = openId === item.id;
                return (
                  <div key={item.id}>
                    <button
                      type="button"
                      onClick={() => setOpenId(isOpen ? "" : item.id)}
                      className="w-full p-4 text-left flex items-center justify-between gap-4 hover:bg-muted/40 transition-colors cursor-pointer"
                    >
                      <span className="text-sm font-semibold text-foreground">
                        {item.question}
                      </span>
                      {isOpen ? (
                        <ChevronUp className="size-4 text-muted-foreground shrink-0" />
                      ) : (
                        <ChevronDown className="size-4 text-muted-foreground shrink-0" />
                      )}
                    </button>
                    {isOpen && (
                      <div className="px-4 pb-4 text-[13px] text-muted-foreground leading-relaxed">
                        {item.answer}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Right: Policy Reference Tables & Legal Summary (5 cols) */}
        <div className="lg:col-span-5 space-y-6">
          <div className="rounded-lg border border-border bg-background p-5 space-y-3">
            <div>
              <h2 className="text-base font-bold text-foreground">
                Biểu mức hoàn vé tiêu chuẩn
              </h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                Áp dụng cho vé ở trạng thái chưa sử dụng và còn trong thời hạn
                cho phép hủy.
              </p>
            </div>

            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Thời điểm yêu cầu hủy</TableHead>
                  <TableHead className="text-right">Mức hoàn lại</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <TableRow>
                  <TableCell className="text-xs">
                    Trước ngày diễn ra từ 7 ngày trở lên
                  </TableCell>
                  <TableCell className="text-right font-mono text-xs font-semibold text-primary">
                    100%
                  </TableCell>
                </TableRow>
                <TableRow>
                  <TableCell className="text-xs">
                    Từ 3 đến dưới 7 ngày trước sự kiện
                  </TableCell>
                  <TableCell className="text-right font-mono text-xs font-semibold text-foreground">
                    70%
                  </TableCell>
                </TableRow>
                <TableRow>
                  <TableCell className="text-xs">
                    Dưới 3 ngày trước sự kiện
                  </TableCell>
                  <TableCell className="text-right font-mono text-xs text-muted-foreground">
                    Không hoàn (0%)
                  </TableCell>
                </TableRow>
                <TableRow>
                  <TableCell className="text-xs">
                    Sự kiện bị hủy hoặc dời lịch bởi BTC
                  </TableCell>
                  <TableCell className="text-right font-mono text-xs font-semibold text-primary">
                    100% (Tự động)
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </div>

          <div className="rounded-lg border border-border bg-background p-5 space-y-2.5">
            <h2 className="text-base font-bold text-foreground">
              Bảo vệ dữ liệu cá nhân (Nghị định 13/2023/NĐ-CP)
            </h2>
            <ul className="space-y-2 text-xs text-muted-foreground leading-relaxed list-disc list-inside">
              <li>
                Thông tin người mua (họ tên, email, số điện thoại) chỉ dùng để
                gửi vé điện tử và đối soát tại cổng sự kiện.
              </li>
              <li>
                Hồ sơ xác minh Ban tổ chức (Mã số thuế 10/13 số hoặc CCCD 12 số)
                được kiểm duyệt nội bộ và ẩn thông tin nhạy cảm trên giao diện
                quản trị.
              </li>
              <li>
                Không lưu trữ thông tin thẻ ngân hàng; toàn bộ giao dịch thanh
                toán và hoàn tiền thực hiện qua cổng thanh toán được cấp phép.
              </li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
