"use client";

import Image from "next/image";
import { Calendar, MapPin, QrCode, CheckCircle2, Clock } from "lucide-react";
import {
  formatTicketVnd,
  type BoardingPassTicketView,
} from "../domain/ticket-rules";

interface TicketCardProps {
  ticket: BoardingPassTicketView;
  qrDataUrl: string;
  qrSecondsLeft: number;
  onOpenQr: (ticket: BoardingPassTicketView) => void;
}

/** The ve dien tu theo bo cuc Boarding Pass dong bo voi he thong. */
export function TicketCard({
  ticket,
  qrDataUrl,
  qrSecondsLeft,
  onOpenQr,
}: TicketCardProps) {
  const statusBadge =
    ticket.status === "CHECKED_IN"
      ? {
          label: "Đã check-in",
          className: "bg-muted text-muted-foreground border-border",
        }
      : ticket.status === "CANCELLED"
        ? {
            label: "Đã hủy",
            className:
              "bg-destructive/10 text-destructive border-destructive/20",
          }
        : {
            label: "Sẵn sàng sử dụng",
            className: "bg-accent text-accent-foreground border-primary/20",
          };

  return (
    <article className="relative rounded-2xl border border-border bg-card shadow-sm overflow-hidden transition-shadow hover:shadow-md">
      <div className="flex flex-col md:flex-row">
        {/* Cot trai: Thong tin su kien va cho ngoi */}
        <div className="flex-1 p-5 sm:p-6 flex flex-col justify-between gap-4">
          <div className="flex items-start gap-4">
            <div className="relative size-20 sm:size-24 rounded-xl overflow-hidden bg-muted border border-border shrink-0">
              <Image
                src={ticket.eventImage}
                alt={ticket.eventTitle}
                fill
                unoptimized
                className="object-cover"
              />
            </div>

            <div className="min-w-0 flex-1 space-y-1.5">
              <div className="flex flex-wrap items-center gap-2">
                <span
                  className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[11px] font-semibold ${statusBadge.className}`}
                >
                  <CheckCircle2 className="size-3" />
                  {statusBadge.label}
                </span>
                <span className="text-[12px] font-mono text-muted-foreground">
                  {ticket.orderCode}
                </span>
              </div>

              <h2 className="text-[17px] sm:text-[18px] font-bold text-foreground leading-snug line-clamp-2">
                {ticket.eventTitle}
              </h2>

              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[13px] text-muted-foreground">
                <span className="inline-flex items-center gap-1.5">
                  <Calendar className="size-3.5 text-primary" />
                  {ticket.fullDateTime}
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <MapPin className="size-3.5 text-primary" />
                  {ticket.venue}
                  {ticket.city ? `, ${ticket.city}` : ""}
                </span>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-4 border-t border-dashed border-border text-[13px]">
            <div>
              <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
                Hạng vé
              </p>
              <p className="font-bold text-foreground truncate">
                {ticket.zoneName}
              </p>
            </div>
            <div>
              <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
                Vị trí
              </p>
              <p className="font-semibold text-foreground truncate">
                {ticket.rowLabel} - {ticket.seatNumbers}
              </p>
            </div>
            <div>
              <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
                Số lượng
              </p>
              <p className="font-semibold text-foreground">
                {ticket.quantity} vé
              </p>
            </div>
            <div>
              <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
                Tổng thanh toán
              </p>
              <p className="font-bold text-primary">
                {formatTicketVnd(ticket.totalPrice)}
              </p>
            </div>
          </div>
        </div>

        {/* Duong cat cuong ve */}
        <div className="relative md:w-px border-t md:border-t-0 md:border-l border-dashed border-border flex items-center justify-center">
          <span className="hidden md:block absolute -top-3 -left-3 size-6 rounded-full bg-background border border-border" />
          <span className="hidden md:block absolute -bottom-3 -left-3 size-6 rounded-full bg-background border border-border" />
        </div>

        {/* Cot phai: Cuong ma QR dong */}
        <div className="md:w-56 p-5 sm:p-6 bg-muted/40 flex flex-col items-center justify-center gap-3 text-center">
          <div className="size-28 rounded-xl bg-white p-2 border border-border shadow-xs flex items-center justify-center">
            {qrDataUrl ? (
              <Image
                src={qrDataUrl}
                alt={`Mã QR vé ${ticket.ticketCode}`}
                width={104}
                height={104}
                unoptimized
                className="w-full h-full object-contain"
              />
            ) : (
              <QrCode className="size-10 text-muted-foreground" />
            )}
          </div>

          <div className="inline-flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground">
            <Clock className="size-3 text-primary" />
            <span>Tự làm mới sau {qrSecondsLeft}s</span>
          </div>

          <button
            type="button"
            onClick={() => onOpenQr(ticket)}
            className="w-full h-9 rounded-lg bg-primary text-primary-foreground text-[13px] font-semibold hover:bg-primary/90 transition-colors cursor-pointer"
          >
            Hiện mã QR lớn
          </button>
        </div>
      </div>
    </article>
  );
}
