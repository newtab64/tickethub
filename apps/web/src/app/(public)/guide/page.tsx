"use client";

import React, { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import {
  BookOpen,
  Building2,
  CheckCircle2,
  QrCode,
  Ticket,
  WifiOff,
} from "lucide-react";

type GuideRoleKey = "buyer" | "organizer" | "staff";

interface GuideStep {
  stepNumber: string;
  title: string;
  description: string;
  checklist: string[];
  imageSrc: string;
  imageAlt: string;
}

const GUIDE_BY_ROLE: Record<
  GuideRoleKey,
  {
    label: string;
    subtitle: string;
    ctaHref: string;
    ctaLabel: string;
    steps: GuideStep[];
  }
> = {
  buyer: {
    label: "Người mua vé",
    subtitle:
      "Quy trình chọn khu vực ghế trên sơ đồ kiến trúc, thanh toán VNPay và xuất trình mã QR động 30 giây tại cổng.",
    ctaHref: "/my-tickets",
    ctaLabel: "Mở trang Vé của tôi",
    steps: [
      {
        stepNumber: "01",
        title: "Chọn khu vực trên sơ đồ khán đài & giữ chỗ 10 phút",
        description:
          "Truy cập trang chi tiết sự kiện, nhấp trực tiếp vào khu vực khán đài trên bản đồ SVG tương tác hoặc danh sách hạng vé bên phải.",
        checklist: [
          "Chọn số lượng từ 1 đến tối đa 6 vé cho mỗi đơn hàng",
          "Hệ thống tự động khóa ghế độc quyền trong 10 phút qua Redis TTL",
          "Theo dõi trạng thái ghế cập nhật thời gian thực qua luồng SSE",
        ],
        imageSrc: "/images/events/vn/anh-trai.jpg",
        imageAlt: "Chọn khu vực ghế trên sơ đồ sự kiện",
      },
      {
        stepNumber: "02",
        title: "Thanh toán qua VNPay & nhận vé điện tử tức thì",
        description:
          "Hoàn tất thanh toán trong thời gian giữ chỗ. Ngay khi VNPay xác nhận chữ ký HMAC-SHA512, vé điện tử sẽ được phát hành tự động.",
        checklist: [
          "Nhận email vé HTML kèm thông tin khu vực, hàng ghế và mã đơn",
          "Vé tự động đồng bộ vào mục Vé của tôi trên cả máy tính và điện thoại",
          "Hỗ trợ lưu bộ nhớ đệm PWA để mở vé dưới 2 giây khi mạng 3G yếu",
        ],
        imageSrc: "/images/events/vn/ha-anh-tuan.jpg",
        imageAlt: "Thanh toán và nhận vé điện tử",
      },
      {
        stepNumber: "03",
        title: "Xuất trình mã QR động 30 giây tại cổng kiểm soát",
        description:
          "Mở mục Vé của tôi và nhấn Mở mã QR. Mã QR sẽ tự động đổi mới mỗi 30 giây và giữ sáng màn hình để máy quét đọc nhanh.",
        checklist: [
          "Không sử dụng ảnh chụp màn hình vì mã QR hết hạn sau mỗi 30 giây",
          "Nếu điện thoại hết pin, cung cấp Mã vé và 4 số cuối SĐT cho nhân viên cổng",
          "Có thể gửi yêu cầu hoàn vé trực tuyến theo đúng mốc thời gian UC06",
        ],
        imageSrc: "/images/events/vn/den-vau.jpg",
        imageAlt: "Xuất trình mã QR động tại cổng",
      },
    ],
  },
  organizer: {
    label: "Ban tổ chức (BTC)",
    subtitle:
      "Khởi tạo sự kiện với 5 mẫu sơ đồ sân vận động/nhà hát chuẩn quốc tế, cấu hình hạng vé và theo dõi doanh thu thực tế.",
    ctaHref: "/organizer/events",
    ctaLabel: "Vào Cổng Ban tổ chức",
    steps: [
      {
        stepNumber: "01",
        title: "Hoàn thiện hồ sơ pháp lý & chọn mẫu sơ đồ địa điểm",
        description:
          "Cập nhật mã số thuế doanh nghiệp (10 hoặc 13 chữ số) hoặc CCCD cá nhân (12 chữ số) và chọn mẫu sơ đồ sân khấu phù hợp.",
        checklist: [
          "5 mẫu sơ đồ thực tế: Sân khấu chữ T, SVĐ Hòa nhạc, SVĐ Bóng đá, Nhà thi đấu, Nhà hát",
          "Thiết lập các hạng vé CAT 1 đến CAT 5 gắn với từng phân khu khán đài",
          "Cấu hình thời điểm mở bán và kích hoạt phòng chờ ảo khi lưu lượng cao",
        ],
        imageSrc: "/images/events/vn/soobin.jpg",
        imageAlt: "Khởi tạo sự kiện và cấu hình sơ đồ",
      },
      {
        stepNumber: "02",
        title: "Phân công nhân viên soát vé & giám sát tỷ lệ check-in",
        description:
          "Tạo tài khoản nhân viên cổng (Gate Staff), gán cổng phụ trách và theo dõi lưu lượng khán giả vào sân theo thời gian thực.",
        checklist: [
          "Theo dõi biểu đồ vé bán ra và tỷ lệ check-in tại từng cổng A, B, C",
          "Xuất báo cáo đối soát doanh thu định dạng CSV/Excel bất đồng bộ",
          "Nhận thanh toán quyết toán tự động sau khi đối soát giao dịch VNPay",
        ],
        imageSrc: "/images/events/vn/vleague-cahn.jpg",
        imageAlt: "Giám sát doanh thu và tỷ lệ check-in",
      },
    ],
  },
  staff: {
    label: "Nhân viên soát vé",
    subtitle:
      "Vận hành thiết bị soát vé PWA tại cổng với tốc độ phản hồi dưới 300ms, tín hiệu âm thanh/rung rõ ràng và tra cứu thủ công.",
    ctaHref: "/gate-scanner",
    ctaLabel: "Mở Thiết bị soát vé PWA",
    steps: [
      {
        stepNumber: "01",
        title: "Chọn sự kiện & vị trí cổng trực trước giờ mở cửa",
        description:
          "Đăng nhập vào ứng dụng Cổng soát vé (/gate-scanner), chọn đúng sự kiện và vị trí cổng được phân công (Cổng A, B hoặc C).",
        checklist: [
          "Cấp quyền truy cập camera sau trên điện thoại iOS/Android",
          "Hỗ trợ kết nối đầu đọc mã vạch cầm tay qua cổng USB hoặc Bluetooth",
          "Kiểm tra âm lượng và phản hồi rung trước khi đón khán giả",
        ],
        imageSrc: "/images/events/vn/saigon-heat.jpg",
        imageAlt: "Chọn cổng trực trên ứng dụng soát vé",
      },
      {
        stepNumber: "02",
        title: "Quét QR động & xử lý sự cố bằng tra cứu 4 số cuối",
        description:
          "Hướng camera vào mã QR động của khách. Màn hình hiển thị màu Xanh (Hợp lệ), Vàng (Vé quét trùng) hoặc Đỏ (Từ chối) ngay lập tức.",
        checklist: [
          "Màn hình Xanh lá kèm âm báo cao: Mời khách qua cổng và hướng dẫn vị trí ghế",
          "Màn hình Vàng/Đỏ kèm rung cảnh báo kép: Kiểm tra thời điểm check-in trước đó",
          "Chuyển sang tab Tra cứu thủ công khi khách hỏng màn hình hoặc hết pin",
        ],
        imageSrc: "/images/events/vn/kich-idecaf.jpg",
        imageAlt: "Quét mã QR và tra cứu thủ công tại cổng",
      },
    ],
  },
};

export default function SystemGuidePage() {
  const [activeRole, setActiveRole] = useState<GuideRoleKey>("buyer");
  const currentGuide = GUIDE_BY_ROLE[activeRole];

  return (
    <div className="bg-muted min-h-screen pb-14">
      {/* Dark top banner dong bo voi Floating PublicHeader */}
      <section className="bg-surface-dark text-white pt-24 pb-10 border-b border-border">
        <div className="max-w-[1200px] mx-auto px-4 sm:px-6">
          <div className="max-w-2xl space-y-2.5">
            <span className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-primary">
              <BookOpen className="size-3.5" /> Cẩm nang vận hành & Sử dụng
            </span>
            <h1 className="text-[24px] sm:text-[30px] font-extrabold tracking-tight leading-tight">
              Hướng dẫn sử dụng hệ thống TicketHub
            </h1>
            <p className="text-[13.5px] text-white/75 leading-relaxed">
              Tài liệu hướng dẫn trực quan từng bước dành cho Người mua vé, Ban
              tổ chức sự kiện và Nhân viên soát vé tại cổng.
            </p>
          </div>

          <div className="mt-6 flex flex-wrap gap-2">
            {[
              {
                key: "buyer" as const,
                label: "Dành cho Người mua vé",
                icon: Ticket,
              },
              {
                key: "organizer" as const,
                label: "Dành cho Ban tổ chức",
                icon: Building2,
              },
              {
                key: "staff" as const,
                label: "Dành cho Nhân viên soát vé",
                icon: QrCode,
              },
            ].map((tab) => {
              const Icon = tab.icon;
              const isActive = activeRole === tab.key;
              return (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => setActiveRole(tab.key)}
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

      {/* Noi dung huong dan theo vai tro */}
      <div className="max-w-[1200px] mx-auto px-4 sm:px-6 pt-8 space-y-6">
        {/* Thanh tom tat vai tro & nut hanh dong */}
        <div className="bg-card border border-border rounded-lg p-5 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <h2 className="text-[17px] font-bold text-foreground">
              Quy trình chuẩn: {currentGuide.label}
            </h2>
            <p className="text-[13px] text-muted-foreground">
              {currentGuide.subtitle}
            </p>
          </div>
          <Link
            href={currentGuide.ctaHref}
            className="h-9 px-4 rounded-md bg-primary hover:bg-primary/90 text-white text-[13px] font-bold inline-flex items-center justify-center shrink-0 transition-colors"
          >
            {currentGuide.ctaLabel}
          </Link>
        </div>

        {/* Danh sach cac buoc kem hinh anh minh hoa */}
        <div className="space-y-4">
          {currentGuide.steps.map((step) => (
            <article
              key={step.stepNumber}
              className="bg-card border border-border rounded-lg overflow-hidden shadow-sm grid grid-cols-1 md:grid-cols-12"
            >
              <div className="md:col-span-4 relative min-h-[200px] bg-surface-dark">
                <Image
                  src={step.imageSrc}
                  alt={step.imageAlt}
                  fill
                  sizes="(max-width: 768px) 100vw, 380px"
                  className="object-cover opacity-90"
                />
                <div className="absolute top-3 left-3 px-2.5 py-1 rounded bg-surface-dark/90 text-white font-mono text-[12px] font-bold border border-white/15">
                  Bước {step.stepNumber}
                </div>
              </div>

              <div className="md:col-span-8 p-5 sm:p-6 flex flex-col justify-center space-y-3">
                <h3 className="text-[16px] font-bold text-foreground">
                  {step.title}
                </h3>
                <p className="text-[13.5px] text-muted-foreground leading-relaxed">
                  {step.description}
                </p>
                <ul className="space-y-2 pt-1">
                  {step.checklist.map((point) => (
                    <li
                      key={point}
                      className="flex items-start gap-2 text-[13px] text-foreground"
                    >
                      <CheckCircle2 className="size-4 text-primary shrink-0 mt-0.5" />
                      <span>{point}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </article>
          ))}
        </div>

        {/* Huong dan cai dat Offline PWA */}
        <section className="bg-card border border-border rounded-lg p-5 sm:p-6 shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-start gap-3.5">
            <div className="size-10 rounded-lg bg-accent text-primary flex items-center justify-center shrink-0">
              <WifiOff className="size-5" />
            </div>
            <div className="space-y-1">
              <h3 className="text-[15px] font-bold text-foreground">
                Chế độ ngoại tuyến (Offline PWA) khi vào khu vực đông khán giả
              </h3>
              <p className="text-[13px] text-muted-foreground leading-relaxed">
                Bạn có thể chọn Thêm vào màn hình chính (Add to Home Screen)
                trên trình duyệt Safari (iOS) hoặc Chrome (Android) để mở danh
                sách vé dưới 2 giây ngay cả khi kết nối 3G/4G tại sân vận động
                bị nghẽn.
              </p>
            </div>
          </div>
          <Link
            href="/faq"
            className="h-9 px-3.5 rounded-md border border-border bg-muted hover:bg-card text-[13px] font-bold text-foreground inline-flex items-center shrink-0 transition-colors"
          >
            Xem thêm FAQ & Pháp lý
          </Link>
        </section>
      </div>
    </div>
  );
}
