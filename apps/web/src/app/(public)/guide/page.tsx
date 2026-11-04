"use client";

import { useState } from "react";
import Link from "next/link";
import { Ticket, QrCode, Building2, ArrowRight } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

type RoleGuideKey = "BUYER" | "GATE_STAFF" | "ORGANIZER";

export default function SystemUserGuidePage() {
  const [activeRole, setActiveRole] = useState<RoleGuideKey>("BUYER");

  return (
    <div className="max-w-[1200px] mx-auto px-4 sm:px-6 py-8 space-y-6">
      {/* 1. Header: Calm & task-oriented */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            Hướng dẫn sử dụng
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Quy trình đặt vé, sử dụng mã QR vào cổng và quản lý sự kiện trên
            TicketHub.
          </p>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          <Link
            href="/faq"
            className="inline-flex items-center h-9 px-3.5 rounded-[8px] border border-border bg-background hover:bg-muted text-foreground text-[13px] font-medium transition-colors"
          >
            Chính sách &amp; FAQ
          </Link>
          <Link
            href="/gate-scanner"
            className="inline-flex items-center h-9 px-3.5 rounded-[8px] bg-primary hover:bg-emerald-700 text-primary-foreground text-[13px] font-semibold transition-colors"
          >
            Soát vé tại cổng
          </Link>
        </div>
      </div>

      {/* 2. Role Filter Tabs */}
      <div className="flex flex-wrap items-center gap-2 border-b border-border pb-3">
        {[
          {
            key: "BUYER",
            label: "Người mua vé",
            icon: Ticket,
          },
          {
            key: "GATE_STAFF",
            label: "Nhân viên soát vé",
            icon: QrCode,
          },
          {
            key: "ORGANIZER",
            label: "Ban tổ chức",
            icon: Building2,
          },
        ].map((tab) => {
          const Icon = tab.icon;
          const active = activeRole === tab.key;
          return (
            <button
              key={tab.key}
              type="button"
              onClick={() => setActiveRole(tab.key as RoleGuideKey)}
              className={`inline-flex items-center gap-2 h-9 px-3.5 rounded-[8px] text-[13px] transition-colors cursor-pointer ${
                active
                  ? "border-[1.5px] border-primary bg-emerald-50/50 text-primary font-semibold"
                  : "border border-border bg-background text-foreground font-medium hover:bg-muted"
              }`}
            >
              <Icon className="size-3.5" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* 3. BUYER GUIDE */}
      {activeRole === "BUYER" && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[
            {
              step: "Bước 1",
              title: "Tìm kiếm sự kiện và xem sơ đồ khu vực",
              desc: "Chọn sự kiện trên trang chủ, xem sơ đồ khán đài để kiểm tra các khu vực còn vé và mức giá tương ứng. Bạn có thể phóng to hoặc thu nhỏ sơ đồ để quan sát chi tiết.",
              link: "/events/evt-anh-trai-vuot-ngan-chong-gai?modal=false",
              linkText: "Xem trang sự kiện",
            },
            {
              step: "Bước 2",
              title: "Chọn số lượng vé và giữ chỗ 5 phút",
              desc: "Chọn hạng vé cùng số lượng cần mua (tối đa 6 vé mỗi đơn). Hệ thống tự động xếp các ghế trống liền kề trong cùng hàng và giữ chỗ riêng cho bạn trong vòng 5 phút.",
              link: "/events/evt-anh-trai-vuot-ngan-chong-gai?modal=false",
              linkText: "Thử giữ chỗ trên sơ đồ",
            },
            {
              step: "Bước 3",
              title: "Thanh toán và nhận vé điện tử",
              desc: "Hoàn tất thanh toán trong thời gian giữ chỗ. Vé điện tử sẽ được lưu ngay trong mục 'Vé của tôi' đồng thời gửi xác nhận qua địa chỉ email đã đăng ký.",
              link: "/my-tickets",
              linkText: "Mở trang Vé của tôi",
            },
            {
              step: "Bước 4",
              title: "Xuất trình mã QR động khi vào cổng",
              desc: "Khi đến sự kiện, mở vé trong mục 'Vé của tôi' để hiển thị mã QR. Mã tự động làm mới mỗi 30 giây, vì vậy vui lòng xuất trình trực tiếp trên màn hình điện thoại thay vì dùng ảnh chụp màn hình.",
              link: "/my-tickets",
              linkText: "Xem mã QR trên vé",
            },
          ].map((item) => (
            <div
              key={item.step}
              className="rounded-lg border border-border bg-background p-5 flex flex-col justify-between gap-4"
            >
              <div className="space-y-1.5">
                <span className="text-xs font-semibold text-primary">
                  {item.step}
                </span>
                <h2 className="text-base font-bold text-foreground">
                  {item.title}
                </h2>
                <p className="text-[13px] text-muted-foreground leading-relaxed">
                  {item.desc}
                </p>
              </div>
              <Link
                href={item.link}
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-primary hover:underline"
              >
                <span>{item.linkText}</span>
                <ArrowRight className="size-3.5" />
              </Link>
            </div>
          ))}
        </div>
      )}

      {/* 4. GATE STAFF GUIDE */}
      {activeRole === "GATE_STAFF" && (
        <div className="space-y-6">
          <div className="rounded-lg border border-border bg-background p-5 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h2 className="text-base font-bold text-foreground">
                  Bảng trạng thái phản hồi khi quét vé tại cổng
                </h2>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Nhân viên chọn đúng sự kiện và vị trí cổng phụ trách trước khi
                  bắt đầu quét mã QR của khách.
                </p>
              </div>
              <Link
                href="/gate-scanner"
                className="inline-flex items-center gap-1.5 h-8 px-3 rounded-[8px] bg-primary hover:bg-emerald-700 text-primary-foreground text-xs font-semibold shrink-0 self-start sm:self-auto"
              >
                <span>Mở màn hình soát vé</span>
                <ArrowRight className="size-3.5" />
              </Link>
            </div>

            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-40">Màu hiển thị</TableHead>
                  <TableHead className="w-48">Trạng thái vé</TableHead>
                  <TableHead>Hướng dẫn xử lý tại cổng</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <TableRow>
                  <TableCell>
                    <span className="inline-flex px-2 py-0.5 rounded-[6px] bg-emerald-50 text-emerald-700 border border-emerald-200 text-xs font-semibold">
                      Màu xanh lá
                    </span>
                  </TableCell>
                  <TableCell className="text-xs font-medium text-foreground">
                    Vé hợp lệ (VALID)
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    Vé được ghi nhận đã check-in. Mời khách qua cổng và hướng
                    dẫn đúng khu vực, hàng ghế hiển thị trên màn hình.
                  </TableCell>
                </TableRow>
                <TableRow>
                  <TableCell>
                    <span className="inline-flex px-2 py-0.5 rounded-[6px] bg-amber-50 text-amber-800 border border-amber-200 text-xs font-semibold">
                      Màu vàng
                    </span>
                  </TableCell>
                  <TableCell className="text-xs font-medium text-foreground">
                    Mã QR quá hạn 30s
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    Mã QR đã hết thời hạn 30 giây hoặc khách đang dùng ảnh chụp
                    màn hình. Yêu cầu khách mở lại trang Vé của tôi để làm mới
                    mã rồi quét lại.
                  </TableCell>
                </TableRow>
                <TableRow>
                  <TableCell>
                    <span className="inline-flex px-2 py-0.5 rounded-[6px] bg-destructive/10 text-destructive text-xs font-semibold">
                      Màu đỏ
                    </span>
                  </TableCell>
                  <TableCell className="text-xs font-medium text-foreground">
                    Vé đã dùng / Không hợp lệ
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    Từ chối vào cổng. Nếu báo vé đã sử dụng, kiểm tra thông tin
                    cổng và thời gian đã soát lần trước hiển thị trên cảnh báo.
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="rounded-lg border border-border bg-background p-5 space-y-1.5">
              <h3 className="text-sm font-bold text-foreground">
                Xử lý khi khách không mở được mã QR
              </h3>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Chuyển sang mục <strong>Tra cứu thủ công</strong>, nhập số điện
                thoại, email hoặc mã vé của khách. Đối chiếu giấy tờ tùy thân
                trùng khớp với tên người mua trước khi bấm xác nhận vào cổng.
              </p>
            </div>

            <div className="rounded-lg border border-border bg-background p-5 space-y-1.5">
              <h3 className="text-sm font-bold text-foreground">
                Xử lý khi mất kết nối mạng tại cổng
              </h3>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Bật chế độ <strong>Ngoại tuyến</strong> để tiếp tục kiểm tra hạn
                token và lưu vào hàng đợi trên thiết bị. Khi có mạng trở lại, mở
                mục <strong>Đồng bộ ngoại tuyến</strong> để đẩy dữ liệu lên máy
                chủ và kiểm tra các vé trùng giữa các cổng.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* 5. ORGANIZER GUIDE */}
      {activeRole === "ORGANIZER" && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="rounded-lg border border-border bg-background p-5 space-y-2">
            <span className="text-xs font-semibold text-primary">Bước 1</span>
            <h2 className="text-base font-bold text-foreground">
              Xác minh hồ sơ Ban tổ chức
            </h2>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Cung cấp thông tin đơn vị tổ chức, người đại diện pháp luật và Mã
              số thuế (10 hoặc 13 chữ số) hoặc CCCD (12 chữ số) để Quản trị viên
              xét duyệt trước khi đăng bán sự kiện.
            </p>
          </div>

          <div className="rounded-lg border border-border bg-background p-5 space-y-2">
            <span className="text-xs font-semibold text-primary">Bước 2</span>
            <h2 className="text-base font-bold text-foreground">
              Chọn địa điểm và cấu hình hạng vé
            </h2>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Chọn địa điểm tổ chức từ danh mục chuẩn hóa, xem trước sơ đồ phân
              khu SVG, thiết lập đơn giá và sức chứa cho từng khu vực trước khi
              gửi phê duyệt xuất bản.
            </p>
          </div>

          <div className="rounded-lg border border-border bg-background p-5 space-y-2">
            <span className="text-xs font-semibold text-primary">Bước 3</span>
            <h2 className="text-base font-bold text-foreground">
              Theo dõi doanh thu và soát vé
            </h2>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Theo dõi số lượng vé bán ra theo thời gian thực và phân công nhân
              viên phụ trách từng cổng kiểm soát trong ngày diễn ra sự kiện.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
