"use client";

import Image from "next/image";
import { X, ShieldCheck, Download, Clock, Sun } from "lucide-react";
import type { BoardingPassTicketView } from "../domain/ticket-rules";

interface TicketQrModalProps {
  ticket: BoardingPassTicketView;
  qrDataUrl: string;
  qrSecondsLeft: number;
  wakeLockActive: boolean;
  onClose: () => void;
}

/** Hop thoai hien thi ma QR lon tai cong soat ve, tu dong lam moi moi 30 giay. */
export function TicketQrModal({
  ticket,
  qrDataUrl,
  qrSecondsLeft,
  wakeLockActive,
  onClose,
}: TicketQrModalProps) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Mã QR vào cổng"
    >
      <div className="w-full max-w-sm rounded-2xl bg-card border border-border shadow-xl overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-primary">
              Mã vé vào cổng
            </p>
            <h3 className="text-[15px] font-bold text-foreground truncate">
              {ticket.eventTitle}
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Đóng hộp thoại mã QR"
            className="size-8 rounded-full hover:bg-muted flex items-center justify-center text-muted-foreground transition-colors cursor-pointer"
          >
            <X className="size-4" />
          </button>
        </div>

        <div className="p-6 flex flex-col items-center text-center space-y-4">
          <div className="p-3 rounded-2xl bg-white border border-border shadow-xs">
            {qrDataUrl && (
              <Image
                src={qrDataUrl}
                alt={`Mã QR vào cổng ${ticket.ticketCode}`}
                width={220}
                height={220}
                unoptimized
                className="size-56 object-contain"
              />
            )}
          </div>

          <div className="w-full rounded-xl bg-muted/60 px-4 py-3 space-y-1.5 text-[12px]">
            <div className="flex items-center justify-between text-foreground font-semibold">
              <span>{ticket.zoneName}</span>
              <span className="font-mono">{ticket.ticketCode}</span>
            </div>
            <div className="flex items-center justify-between text-muted-foreground">
              <span>Vị trí ghế</span>
              <span>
                {ticket.rowLabel} - {ticket.seatNumbers}
              </span>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-2 text-[12px]">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-accent text-accent-foreground px-3 py-1 font-semibold">
              <Clock className="size-3.5" />
              Đổi mã mới sau {qrSecondsLeft} giây
            </span>
            {wakeLockActive && (
              <span className="inline-flex items-center gap-1 rounded-full bg-muted text-muted-foreground px-2.5 py-1 font-medium">
                <Sun className="size-3.5 text-amber-500" />
                Đang giữ sáng màn hình
              </span>
            )}
          </div>

          <p className="inline-flex items-center gap-1.5 text-[12px] text-muted-foreground">
            <ShieldCheck className="size-4 text-primary shrink-0" />
            <span>
              Đưa mã này cho nhân viên tại cổng. Không chụp màn hình gửi cho
              người lạ.
            </span>
          </p>

          <div className="w-full space-y-2 pt-1">
            {qrDataUrl && (
              <a
                href={qrDataUrl}
                download={`TicketHub-${ticket.ticketCode}.png`}
                className="w-full h-10 rounded-lg bg-primary text-primary-foreground text-[13px] font-semibold inline-flex items-center justify-center gap-2 hover:bg-primary/90 transition-colors"
              >
                <Download className="size-4" />
                Tải ảnh mã QR
              </a>
            )}
            <button
              type="button"
              onClick={onClose}
              className="w-full h-9 rounded-lg border border-border bg-background hover:bg-muted text-[13px] font-semibold text-muted-foreground transition-colors cursor-pointer"
            >
              Đóng
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
