"use client";

import { Suspense } from "react";
import Link from "next/link";
import { Ticket } from "lucide-react";
import type { TicketFilterTab } from "../domain/ticket-rules";
import { useMyTicketsScreen } from "./use-my-tickets-screen";
import { TicketCard } from "./ticket-card";
import { TicketQrModal } from "./ticket-qr-modal";

const TABS: { key: TicketFilterTab; label: string }[] = [
  { key: "ALL", label: "Tất cả" },
  { key: "ISSUED", label: "Sắp diễn ra" },
  { key: "CHECKED_IN", label: "Đã sử dụng" },
  { key: "CANCELLED", label: "Đã hủy" },
];

function MyTicketsContent() {
  const vm = useMyTicketsScreen();

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-[24px] font-bold text-foreground tracking-tight">
            Vé của tôi
          </h1>
          <p className="text-[14px] text-muted-foreground mt-1">
            Quản lý vé điện tử và mở mã QR tự làm mới để quét trực tiếp tại cổng
            sự kiện.
          </p>
        </div>
        <Link
          href="/"
          className="inline-flex items-center justify-center h-9 px-4 rounded-lg border border-border bg-card hover:bg-muted text-[13px] font-semibold text-foreground transition-colors"
        >
          Khám phá thêm sự kiện
        </Link>
      </div>

      {/* Thanh loc trang thai ve */}
      <div className="flex flex-wrap items-center gap-2 border-b border-border pb-3">
        {TABS.map((tab) => {
          const isActive = vm.activeTab === tab.key;
          const count =
            tab.key === "ALL"
              ? vm.tickets.length
              : vm.tickets.filter((t) => t.status === tab.key).length;
          return (
            <button
              key={tab.key}
              type="button"
              onClick={() => vm.setActiveTab(tab.key)}
              className={`inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full text-[13px] font-semibold transition-colors cursor-pointer ${
                isActive
                  ? "bg-primary text-primary-foreground"
                  : "bg-card border border-border text-muted-foreground hover:text-foreground"
              }`}
            >
              <span>{tab.label}</span>
              <span
                className={`text-[11px] px-1.5 py-0.5 rounded-full ${
                  isActive
                    ? "bg-white/20 text-primary-foreground"
                    : "bg-muted text-muted-foreground"
                }`}
              >
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Danh sach ve */}
      {vm.filteredTickets.length === 0 ? (
        <div className="rounded-2xl border border-border bg-card p-10 text-center space-y-3">
          <div className="size-12 rounded-full bg-muted mx-auto flex items-center justify-center text-muted-foreground">
            <Ticket className="size-6" />
          </div>
          <p className="text-[15px] font-semibold text-foreground">
            Chưa có vé nào ở mục này
          </p>
          <p className="text-[13px] text-muted-foreground">
            Các vé bạn đặt thành công sẽ hiển thị ngay tại đây kèm mã QR vào
            cổng.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {vm.filteredTickets.map((ticket) => (
            <TicketCard
              key={ticket.ticketId}
              ticket={ticket}
              qrDataUrl={vm.qrDataUrl}
              qrSecondsLeft={vm.qrSecondsLeft}
              onOpenQr={vm.openQrModal}
            />
          ))}
        </div>
      )}

      {vm.isQrModalOpen && (
        <TicketQrModal
          ticket={vm.selectedTicket}
          qrDataUrl={vm.qrDataUrl}
          qrSecondsLeft={vm.qrSecondsLeft}
          wakeLockActive={vm.wakeLockActive}
          onClose={() => vm.setIsQrModalOpen(false)}
        />
      )}
    </div>
  );
}

export function MyTicketsPage() {
  return (
    <Suspense
      fallback={
        <div className="py-12 text-sm text-muted-foreground">
          Đang tải danh sách vé...
        </div>
      }
    >
      <MyTicketsContent />
    </Suspense>
  );
}
