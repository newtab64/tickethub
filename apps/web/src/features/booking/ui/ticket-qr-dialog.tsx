"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import QRCode from "qrcode";
import { X } from "lucide-react";
import { Dialog as DialogPrimitive } from "radix-ui";
import { Dialog, DialogContent } from "@/shared/ui/dialog";
import { FlowError } from "@/shared/ui/flow-shell";
import { useReturnFocus } from "./use-return-focus";
import { useTicketQr } from "./use-ticket-qr";

export interface QrTicket {
  id: string;
  title: string;
  detail: string;
  code: string;
}

const SWIPE_PX = 60;

/** Vẽ mã QR ngay trong trình duyệt; không gửi token ra ngoài. */
function useQrImage(token: string | null) {
  const [image, setImage] = useState<{ token: string; src: string } | null>(
    null,
  );
  useEffect(() => {
    if (!token) return;
    let ignore = false;
    // Mức sửa lỗi thấp cho ô mã to hơn: màn hình không bị rách hay bẩn.
    QRCode.toDataURL(token, {
      margin: 0,
      width: 560,
      errorCorrectionLevel: "L",
    })
      .then((src) => {
        if (!ignore) setImage({ token, src });
      })
      .catch((cause) => console.error("Không vẽ được mã QR", cause));
    return () => {
      ignore = true;
    };
  }, [token]);
  // Chỉ trả ảnh đúng với token hiện tại.
  return image && image.token === token ? image.src : null;
}

const MESSAGE_BOX =
  "flex size-full flex-col items-center justify-center gap-2 rounded-2xl bg-muted p-6 text-center";
const ACTION =
  "mt-2 h-11 cursor-pointer rounded-full bg-primary px-6 text-[15px] font-semibold text-primary-foreground hover:bg-primary-strong";

export function TicketQrDialog({
  tickets,
  openId,
  onOpenChange,
  onRejected,
}: {
  tickets: QrTicket[];
  openId: string | null;
  onOpenChange: (ticketId: string | null) => void;
  /** Máy chủ từ chối cấp mã: dữ liệu đơn có thể đã cũ. */
  onRejected: () => void;
}) {
  const index = tickets.findIndex((ticket) => ticket.id === openId);
  // Vé vừa bị loại khỏi danh sách vẫn giữ thông tin để hiện lý do từ chối.
  const [last, setLast] = useState<QrTicket | null>(null);
  const found = index >= 0 ? tickets[index]! : null;
  if (found && found !== last) setLast(found);
  const ticket = found ?? (last?.id === openId ? last : null);

  const qr = useTicketQr(openId);
  const src = useQrImage(qr.token);
  const [copied, setCopied] = useState<string | null>(null);
  const swipeStart = useRef<number | null>(null);

  const rejected = qr.view === "rejected";
  useEffect(() => {
    if (rejected) onRejected();
    // Chỉ báo một lần mỗi khi chuyển sang từ chối.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rejected, openId]);

  const returnFocus = useReturnFocus();

  const go = (step: number) => {
    const next = tickets[index + step];
    if (index >= 0 && next) onOpenChange(next.id);
  };

  return (
    <Dialog
      open={ticket !== null}
      onOpenChange={(open) => {
        if (!open) onOpenChange(null);
      }}
    >
      {ticket && (
        <DialogContent
          showCloseButton={false}
          {...returnFocus}
          className="touch-pan-y max-h-[calc(100dvh-2rem)] max-w-[min(22.5rem,calc(100%-2rem))] justify-items-center gap-4 overflow-y-auto rounded-3xl p-6 text-center sm:max-w-90"
          onKeyDown={(event) => {
            if (event.key === "ArrowRight") go(1);
            if (event.key === "ArrowLeft") go(-1);
          }}
          onPointerDown={(event) => {
            // Kéo chuột là để bôi đen chữ, không phải vuốt đổi vé.
            swipeStart.current =
              event.pointerType === "mouse" ? null : event.clientX;
          }}
          onPointerUp={(event) => {
            const start = swipeStart.current;
            swipeStart.current = null;
            if (start === null) return;
            const delta = event.clientX - start;
            if (Math.abs(delta) > SWIPE_PX) go(delta < 0 ? 1 : -1);
          }}
        >
          <div className="grid w-full grid-cols-[2.75rem_1fr_2.75rem] items-start">
            <div className="col-start-2 pt-2">
              <DialogPrimitive.Title className="text-[17px] font-semibold">
                {ticket.title}
              </DialogPrimitive.Title>
              <DialogPrimitive.Description className="text-[15px] text-muted-foreground">
                {ticket.detail}
              </DialogPrimitive.Description>
            </div>
            <DialogPrimitive.Close
              aria-label="Đóng"
              className="col-start-3 row-start-1 flex size-11 cursor-pointer items-center justify-center rounded-full bg-fill hover:bg-fill-hover"
            >
              <X aria-hidden="true" className="size-5" />
            </DialogPrimitive.Close>
          </div>

          <div className="flex aspect-square w-full max-w-70 items-center justify-center">
            {rejected ? (
              <div className={MESSAGE_BOX}>
                <p className="text-[15px] font-semibold">Không thể hiện mã</p>
                <FlowError error={qr.error} />
              </div>
            ) : qr.view === "offline" ? (
              <div className={MESSAGE_BOX} role="alert">
                <p className="text-[15px] font-semibold">
                  {qr.hadCode ? "Mã đã hết hạn" : "Chưa lấy được mã"}
                </p>
                <p className="text-[13px] text-muted-foreground">
                  Kiểm tra mạng rồi thử lại.
                </p>
                <button type="button" className={ACTION} onClick={qr.retry}>
                  Thử lại
                </button>
              </div>
            ) : src ? (
              <Image
                src={src}
                alt={`Mã QR vé ${ticket.title}, ${ticket.detail}`}
                width={280}
                height={280}
                unoptimized
                draggable={false}
                className="size-full"
              />
            ) : (
              <div
                role="status"
                className="size-full animate-pulse rounded-2xl bg-muted motion-reduce:animate-none"
              >
                <span className="sr-only">Đang tạo mã...</span>
              </div>
            )}
          </div>

          <p
            className={`flex min-h-6 items-center gap-2 text-[13px] tabular-nums ${
              qr.view === "soon" ? "text-warning" : "text-muted-foreground"
            }`}
          >
            {(qr.view === "live" || qr.view === "soon") && (
              <>
                <span
                  aria-hidden="true"
                  className="size-4 rounded-full"
                  style={{
                    background: `conic-gradient(${qr.view === "soon" ? "var(--warning-ring)" : "var(--primary)"} ${(qr.secondsLeft / qr.totalSeconds) * 100}%, var(--border) 0)`,
                    mask: "radial-gradient(circle, transparent 4.5px, black 5px)",
                  }}
                />
                Mã đổi sau {qr.secondsLeft} giây
              </>
            )}
          </p>

          <button
            type="button"
            title="Chạm để sao chép"
            className="min-h-11 cursor-pointer rounded-full px-1 text-[13px] tracking-tighter break-all text-muted-foreground tabular-nums hover:bg-muted"
            onClick={() => {
              void navigator.clipboard
                ?.writeText(ticket.code)
                .then(() => setCopied(ticket.code))
                .catch(() => setCopied(null));
            }}
          >
            {copied === ticket.code ? "Đã sao chép mã vé" : ticket.code}
          </button>

          {tickets.length > 1 && index >= 0 && (
            <div className="flex flex-wrap justify-center">
              {tickets.map((item, i) => (
                <button
                  key={item.id}
                  type="button"
                  aria-label={`Vé ${i + 1}: ${item.title}, ${item.detail}`}
                  aria-current={i === index}
                  onClick={() => onOpenChange(item.id)}
                  className="flex size-11 cursor-pointer items-center justify-center rounded-full after:size-2 after:rounded-full after:bg-fill-hover aria-[current=true]:after:bg-foreground"
                />
              ))}
            </div>
          )}
        </DialogContent>
      )}
    </Dialog>
  );
}
