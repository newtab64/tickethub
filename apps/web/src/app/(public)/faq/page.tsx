"use client";

import React, { useMemo, useState } from "react";
import Link from "next/link";
import {
  ChevronDown,
  FileText,
  HelpCircle,
  Lock,
  RefreshCcw,
  Search,
  ShieldCheck,
} from "lucide-react";

type LegalTabKey = "faq" | "terms" | "privacy" | "refund";

interface FaqItem {
  id: string;
  category: "booking" | "payment" | "checkin" | "refund";
  categoryLabel: string;
  question: string;
  answer: string;
}

const FAQ_ITEMS: FaqItem[] = [
  {
    id: "faq-hold-ttl",
    category: "booking",
    categoryLabel: "Đặt vé & Giữ ghế",
    question: "Hệ thống giữ chỗ cho tôi trong bao lâu khi chọn ghế?",
    answer:
      "Ngay khi bạn bấm Tiếp tục thanh toán tại sơ đồ sân vận động hoặc nhà hát, hệ thống khóa vị trí ghế độc quyền trong 10 phút (600 giây) qua Redis TTL. Nếu hết thời gian mà giao dịch chưa hoàn tất, ghế sẽ tự động mở lại cho người mua khác.",
  },
  {
    id: "faq-max-qty",
    category: "booking",
    categoryLabel: "Đặt vé & Giữ ghế",
    question: "Mỗi đơn hàng được mua tối đa bao nhiêu vé?",
    answer:
      "Theo quy định chống đầu cơ vé (UC04), mỗi đơn hàng được phép đặt tối thiểu 1 vé và tối đa 6 vé. Với các sự kiện có độ nóng cao, hàng chờ ảo (Virtual Waiting Room) sẽ điều tiết lượt truy cập công bằng theo thứ tự.",
  },
  {
    id: "faq-vnpay",
    category: "payment",
    categoryLabel: "Thanh toán VNPay",
    question:
      "Tôi đã bị trừ tiền qua VNPay nhưng chưa thấy vé thì xử lý thế nào?",
    answer:
      "Hệ thống xử lý bất đồng bộ qua luồng IPN có chữ ký HMAC-SHA512 từ VNPay. Vé điện tử sẽ xuất hiện tại mục Vé của tôi và gửi về Email trong vòng 10 đến 30 giây. Trường hợp đơn hàng đã hết hạn giữ chỗ khi ngân hàng báo thành công, hệ thống tự động tạo lệnh hoàn tiền 100%.",
  },
  {
    id: "faq-dynamic-qr",
    category: "checkin",
    categoryLabel: "Check-in & QR động",
    question: "Tôi có thể dùng ảnh chụp màn hình mã QR để qua cổng không?",
    answer:
      "Không. TicketHub sử dụng mã QR động tự động làm mới mỗi 30 giây kèm chữ ký bảo mật nhằm ngăn chặn vé giả và vé sao chép. Bạn vui lòng mở trực tiếp trang Vé của tôi trên điện thoại khi đến cổng soát vé.",
  },
  {
    id: "faq-offline-pwa",
    category: "checkin",
    categoryLabel: "Check-in & QR động",
    question:
      "Nếu tại sân vận động sóng 3G/4G yếu thì tôi mở vé bằng cách nào?",
    answer:
      "Ứng dụng Web (PWA) của TicketHub tự động lưu bộ nhớ đệm (Service Worker cache) danh sách vé của bạn sau khi mở lần đầu. Khi mất mạng hoặc gặp sự cố thiết bị, nhân viên tại cổng có thể hỗ trợ tra cứu thủ công bằng Mã vé kết hợp 4 ký tự cuối số điện thoại.",
  },
  {
    id: "faq-refund-rule",
    category: "refund",
    categoryLabel: "Hoàn tiền & Hủy vé",
    question:
      "Mức hoàn tiền khi tôi chủ động yêu cầu hủy vé được tính như thế nào?",
    answer:
      "Theo chính sách UC06: Yêu cầu hủy trước ngày diễn ra sự kiện từ 7 ngày trở lên được hoàn 100% giá trị vé; từ 3 đến dưới 7 ngày được hoàn 70%; trong vòng 72 giờ trước giờ mở cửa sẽ không áp dụng hoàn vé (trừ trường hợp sự kiện bị hủy hoặc dời lịch bởi Ban tổ chức).",
  },
];

export default function FaqAndLegalPage() {
  const [activeTab, setActiveTab] = useState<LegalTabKey>("faq");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [openFaqId, setOpenFaqId] = useState<string>(FAQ_ITEMS[0].id);

  const filteredFaqs = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return FAQ_ITEMS.filter((item) => {
      const matchCat =
        selectedCategory === "all" || item.category === selectedCategory;
      const matchText =
        !q ||
        item.question.toLowerCase().includes(q) ||
        item.answer.toLowerCase().includes(q);
      return matchCat && matchText;
    });
  }, [searchQuery, selectedCategory]);

  return (
    <div className="bg-muted min-h-screen pb-14">
      {/* Dark top banner de dong bo voi Floating PublicHeader */}
      <section className="bg-surface-dark text-white pt-24 pb-10 border-b border-border">
        <div className="max-w-[1200px] mx-auto px-4 sm:px-6">
          <div className="max-w-2xl space-y-2.5">
            <span className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-primary">
              <ShieldCheck className="size-3.5" /> Trung tâm Hỗ trợ & Pháp lý
            </span>
            <h1 className="text-[24px] sm:text-[30px] font-extrabold tracking-tight leading-tight">
              Câu hỏi thường gặp & Quy định dịch vụ
            </h1>
            <p className="text-[13.5px] text-white/75 leading-relaxed">
              Tra cứu nhanh quy định đặt vé, cơ chế bảo vệ người mua, chính sách
              bảo vệ dữ liệu cá nhân theo Nghị định 13/2023/NĐ-CP và quy trình
              hoàn tiền minh bạch.
            </p>
          </div>

          {/* Thanh chuyen muc chinh */}
          <div className="mt-6 flex flex-wrap gap-2">
            {[
              {
                key: "faq" as const,
                label: "Câu hỏi thường gặp (FAQ)",
                icon: HelpCircle,
              },
              {
                key: "terms" as const,
                label: "Điều khoản sử dụng",
                icon: FileText,
              },
              {
                key: "privacy" as const,
                label: "Chính sách bảo mật (NĐ 13/2023)",
                icon: Lock,
              },
              {
                key: "refund" as const,
                label: "Chính sách hoàn vé (UC06)",
                icon: RefreshCcw,
              },
            ].map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.key;
              return (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => setActiveTab(tab.key)}
                  className={`h-9 px-3.5 rounded-md text-[13px] font-bold inline-flex items-center gap-2 transition-colors ${
                    isActive
                      ? "bg-primary text-white"
                      : "bg-white/10 text-white/80 hover:bg-white/15 hover:text-white"
                  }`}
                >
                  <Icon className="size-3.5" />
                  {tab.label}
                </button>
              );
            })}
          </div>
        </div>
      </section>

      {/* Noi dung chi tiet */}
      <div className="max-w-[1200px] mx-auto px-4 sm:px-6 pt-8">
        {activeTab === "faq" && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Cot trai: Tim kiem va bo loc danh muc */}
            <aside className="lg:col-span-4 space-y-4">
              <div className="bg-card border border-border rounded-lg p-4 shadow-sm space-y-3">
                <label
                  htmlFor="faq-search-input"
                  className="block text-[12px] font-bold uppercase tracking-wider text-muted-foreground"
                >
                  Tìm kiếm câu hỏi
                </label>
                <div className="relative">
                  <Search className="size-4 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    id="faq-search-input"
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Nhập từ khóa (VD: QR động, hoàn tiền...)"
                    className="w-full h-9 pl-9 pr-3 rounded-md border border-border bg-muted text-[13px] text-foreground focus:outline-none focus:border-primary"
                  />
                </div>

                <div className="pt-2 space-y-1">
                  {[
                    { id: "all", label: "Tất cả chủ đề" },
                    { id: "booking", label: "Đặt vé & Giữ ghế" },
                    { id: "payment", label: "Thanh toán VNPay" },
                    { id: "checkin", label: "Check-in & QR động" },
                    { id: "refund", label: "Hoàn tiền & Hủy vé" },
                  ].map((cat) => (
                    <button
                      key={cat.id}
                      type="button"
                      onClick={() => setSelectedCategory(cat.id)}
                      className={`w-full text-left px-3 py-2 rounded-md text-[13px] font-semibold transition-colors ${
                        selectedCategory === cat.id
                          ? "bg-accent text-accent-foreground"
                          : "text-muted-foreground hover:bg-muted hover:text-foreground"
                      }`}
                    >
                      {cat.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="bg-card border border-border rounded-lg p-4 shadow-sm space-y-2">
                <h2 className="text-[14px] font-bold text-foreground">
                  Cần hướng dẫn trực quan?
                </h2>
                <p className="text-[12.5px] text-muted-foreground leading-relaxed">
                  Xem tài liệu hướng dẫn từng bước bằng hình ảnh dành cho Người
                  mua vé, Ban tổ chức và Nhân viên soát vé.
                </p>
                <Link
                  href="/guide"
                  className="inline-flex items-center text-[13px] font-bold text-primary hover:underline pt-1"
                >
                  Mở trang Hướng dẫn sử dụng
                </Link>
              </div>
            </aside>

            {/* Cot phai: Danh sach cau hoi Accordion */}
            <div className="lg:col-span-8 space-y-3">
              {filteredFaqs.length === 0 ? (
                <div className="bg-card border border-border rounded-lg p-8 text-center">
                  <p className="text-[14px] font-semibold text-foreground">
                    Không tìm thấy câu hỏi phù hợp với từ khóa của bạn.
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      setSearchQuery("");
                      setSelectedCategory("all");
                    }}
                    className="mt-3 h-8 px-3 rounded-md bg-muted border border-border text-[12px] font-bold text-foreground"
                  >
                    Xóa bộ lọc
                  </button>
                </div>
              ) : (
                filteredFaqs.map((item) => {
                  const isOpen = openFaqId === item.id;
                  return (
                    <div
                      key={item.id}
                      className="bg-card border border-border rounded-lg overflow-hidden shadow-sm"
                    >
                      <button
                        type="button"
                        onClick={() => setOpenFaqId(isOpen ? "" : item.id)}
                        aria-expanded={isOpen}
                        className="w-full px-5 py-4 text-left flex items-center justify-between gap-4 hover:bg-muted/60 transition-colors"
                      >
                        <div className="space-y-1">
                          <span className="inline-block text-[11px] font-bold uppercase tracking-wider text-primary">
                            {item.categoryLabel}
                          </span>
                          <h3 className="text-[14.5px] font-bold text-foreground leading-snug">
                            {item.question}
                          </h3>
                        </div>
                        <ChevronDown
                          className={`size-4 text-muted-foreground shrink-0 transition-transform ${
                            isOpen ? "rotate-180 text-primary" : ""
                          }`}
                        />
                      </button>
                      {isOpen && (
                        <div className="px-5 pb-4 pt-1 border-t border-border/60 text-[13.5px] text-muted-foreground leading-relaxed">
                          {item.answer}
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>
        )}

        {activeTab === "terms" && (
          <article className="bg-card border border-border rounded-lg p-6 sm:p-8 shadow-sm max-w-4xl space-y-5">
            <div>
              <h2 className="text-[18px] font-bold text-foreground">
                Điều khoản sử dụng dịch vụ TicketHub
              </h2>
              <p className="text-[12px] text-muted-foreground mt-1">
                Hiệu lực áp dụng: Tháng 11/2026 trên toàn hệ thống bán vé và
                soát vé
              </p>
            </div>

            <div className="space-y-4 text-[13.5px] text-foreground leading-relaxed">
              <section className="space-y-1.5">
                <h3 className="font-bold text-[14.5px]">
                  1. Quy định về tài khoản và định danh giao dịch
                </h3>
                <p className="text-muted-foreground">
                  Người mua vé cam kết cung cấp địa chỉ email và số điện thoại
                  chính xác để nhận mã vé điện tử cũng như phục vụ việc xác minh
                  4 số cuối khi cần hỗ trợ soát vé thủ công tại cổng sự kiện.
                </p>
              </section>

              <section className="space-y-1.5">
                <h3 className="font-bold text-[14.5px]">
                  2. Cơ chế giữ chỗ và giới hạn số lượng vé (UC04)
                </h3>
                <p className="text-muted-foreground">
                  Mỗi phiên giữ chỗ có thời hạn cố định 10 phút trên máy chủ.
                  Mỗi đơn hàng chỉ được đặt tối đa 6 vé nhằm bảo đảm quyền tiếp
                  cận công bằng cho khán giả và ngăn chặn hành vi đầu cơ tự
                  động.
                </p>
              </section>

              <section className="space-y-1.5">
                <h3 className="font-bold text-[14.5px]">
                  3. Quy định sử dụng mã QR động tại cổng kiểm soát (UC08)
                </h3>
                <p className="text-muted-foreground">
                  Mỗi vé hợp lệ chỉ cho phép 01 lượt check-in duy nhất. Mã QR
                  động tự động thay đổi mỗi 30 giây trên ứng dụng. Ban tổ chức
                  có quyền từ chối các trường hợp sử dụng ảnh chụp màn hình hoặc
                  vé đã được ghi nhận qua cổng trước đó.
                </p>
              </section>
            </div>
          </article>
        )}

        {activeTab === "privacy" && (
          <article className="bg-card border border-border rounded-lg p-6 sm:p-8 shadow-sm max-w-4xl space-y-5">
            <div>
              <h2 className="text-[18px] font-bold text-foreground">
                Chính sách bảo vệ dữ liệu cá nhân (Nghị định 13/2023/NĐ-CP)
              </h2>
              <p className="text-[12px] text-muted-foreground mt-1">
                Tuân thủ Nghị định số 13/2023/NĐ-CP của Chính phủ về bảo vệ dữ
                liệu cá nhân
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-[13px]">
              <div className="p-4 rounded-md bg-muted border border-border space-y-1.5">
                <h3 className="font-bold text-foreground">
                  Phạm vi dữ liệu thu thập
                </h3>
                <p className="text-muted-foreground leading-relaxed">
                  Hệ thống chỉ thu thập dữ liệu cá nhân cơ bản gồm: Họ tên, Địa
                  chỉ Email, Số điện thoại liên hệ và Mã số thuế/CCCD (đối với
                  Ban tổ chức sự kiện để đối soát doanh thu).
                </p>
              </div>

              <div className="p-4 rounded-md bg-muted border border-border space-y-1.5">
                <h3 className="font-bold text-foreground">
                  Mục đích xử lý dữ liệu
                </h3>
                <p className="text-muted-foreground leading-relaxed">
                  Phát hành vé điện tử QR động, gửi thông báo thay đổi lịch sự
                  kiện, đối soát hoàn tiền qua cổng VNPay và xác minh quyền sở
                  hữu vé tại cổng soát vé.
                </p>
              </div>

              <div className="p-4 rounded-md bg-muted border border-border space-y-1.5">
                <h3 className="font-bold text-foreground">
                  Biện pháp bảo mật kỹ thuật
                </h3>
                <p className="text-muted-foreground leading-relaxed">
                  Mật khẩu được băm một chiều bằng bcrypt; phiên đăng nhập bảo
                  vệ bằng HTTP-Only Cookie và chữ ký JWT; không lưu trữ thông
                  tin thẻ ngân hàng của người mua trên hệ thống TicketHub.
                </p>
              </div>

              <div className="p-4 rounded-md bg-muted border border-border space-y-1.5">
                <h3 className="font-bold text-foreground">
                  Quyền của chủ thể dữ liệu
                </h3>
                <p className="text-muted-foreground leading-relaxed">
                  Theo Điều 9 Nghị định 13/2023/NĐ-CP, người dùng có quyền truy
                  cập, chỉnh sửa thông tin cá nhân, rút lại sự đồng ý hoặc yêu
                  cầu xóa dữ liệu khi không còn giao dịch phát sinh.
                </p>
              </div>
            </div>
          </article>
        )}

        {activeTab === "refund" && (
          <article className="bg-card border border-border rounded-lg p-6 sm:p-8 shadow-sm max-w-4xl space-y-5">
            <div>
              <h2 className="text-[18px] font-bold text-foreground">
                Chính sách hoàn tiền và hủy vé tiêu chuẩn (UC06)
              </h2>
              <p className="text-[12px] text-muted-foreground mt-1">
                Áp dụng tự động cho mọi yêu cầu hoàn vé hợp lệ trên hệ thống
              </p>
            </div>

            <div className="overflow-x-auto border border-border rounded-md">
              <table className="w-full text-left border-collapse text-[13px]">
                <thead>
                  <tr className="bg-muted border-b border-border text-foreground">
                    <th className="py-3 px-4 font-bold">
                      Thời điểm gửi yêu cầu hủy vé
                    </th>
                    <th className="py-3 px-4 font-bold">Mức hoàn tiền</th>
                    <th className="py-3 px-4 font-bold">
                      Trạng thái ghế sau khi hoàn
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border text-muted-foreground">
                  <tr>
                    <td className="py-3 px-4 font-medium text-foreground">
                      Trước giờ diễn ra sự kiện từ 7 ngày trở lên (&ge; 168 giờ)
                    </td>
                    <td className="py-3 px-4 font-bold text-primary">
                      Hoàn 100% giá trị vé
                    </td>
                    <td className="py-3 px-4">
                      Mở lại trạng thái AVAILABLE trên sơ đồ ghế
                    </td>
                  </tr>
                  <tr>
                    <td className="py-3 px-4 font-medium text-foreground">
                      Từ 3 ngày đến dưới 7 ngày (72 giờ đến &lt; 168 giờ)
                    </td>
                    <td className="py-3 px-4 font-bold text-amber-700">
                      Hoàn 70% giá trị vé (phí hủy 30%)
                    </td>
                    <td className="py-3 px-4">
                      Mở lại trạng thái AVAILABLE trên sơ đồ ghế
                    </td>
                  </tr>
                  <tr>
                    <td className="py-3 px-4 font-medium text-foreground">
                      Dưới 3 ngày (&lt; 72 giờ) hoặc vé đã Check-in
                    </td>
                    <td className="py-3 px-4 font-bold text-destructive">
                      0% (Không hỗ trợ hủy vé)
                    </td>
                    <td className="py-3 px-4">Giữ nguyên trạng thái SOLD</td>
                  </tr>
                  <tr>
                    <td className="py-3 px-4 font-medium text-foreground">
                      Sự kiện bị tạm ngưng / hủy bỏ bởi Ban tổ chức (UC10)
                    </td>
                    <td className="py-3 px-4 font-bold text-primary">
                      Hoàn 100% tự động
                    </td>
                    <td className="py-3 px-4">
                      Đóng băng sự kiện và hoàn tiền toàn bộ đơn hàng
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </article>
        )}
      </div>
    </div>
  );
}
