"use client";

import { use, useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { BuyerOrderDetailSchema } from "@tickethub/shared";
import { AccountMenu } from "@/features/identity";
import { apiClient } from "@/shared/api/client";
import { Button } from "@/shared/ui/button";
import { FlowShell, FlowError } from "@/shared/ui/flow-shell";
import { MyTicketsLink, SiteHeader } from "@/shared/ui/site-header";
import {
  canShowQr,
  listedTickets,
  noQrReason,
  primaryAction,
  seatDetail,
} from "../domain/ticket-qr";
import { OrderDetails } from "./order-details";
import { OrderTicketsCard } from "./order-tickets-card";
import { RefundDialog } from "./refund-dialog";
import { TicketQrDialog } from "./ticket-qr-dialog";
import { useRefund } from "./use-refund";

const PRIMARY =
  "flex h-14 w-full cursor-pointer items-center justify-center rounded-full bg-primary px-6 text-[17px] font-semibold text-primary-foreground hover:bg-primary-strong disabled:cursor-default disabled:opacity-40";

function OrderDetail({ id }: { id: string }) {
  const query = useQuery({
    queryKey: ["buyer-order", id],
    queryFn: async () =>
      BuyerOrderDetailSchema.parse(
        await apiClient<unknown>(`/buyer/orders/${encodeURIComponent(id)}`),
      ),
    retry: false,
  });
  const refetch = () => void query.refetch();
  const refund = useRefund(id, refetch);
  const [qrTicket, setQrTicket] = useState<string | null>(null);
  const order = query.data;

  if (!order) {
    return query.error ? (
      <>
        <FlowError error={query.error} />
        <Button className="mt-4 h-11" onClick={refetch}>
          Thử lại
        </Button>
      </>
    ) : (
      <p role="status">Đang tải đơn hàng...</p>
    );
  }

  // Cùng thứ tự với danh sách trên thẻ.
  const qrTickets = listedTickets(order)
    .filter((ticket) => canShowQr(ticket, order.event.status))
    .map((ticket) => ({
      id: ticket.id,
      title: ticket.ticketTypeName,
      detail: seatDetail(ticket),
      code: ticket.ticketCode,
    }));
  const action = primaryAction(order);
  const reason = noQrReason(order);
  const count = refund.selected.length;

  return (
    <div className="grid grid-cols-1 gap-4">
      {refund.notice && (
        <p
          role="status"
          className="rounded-3xl bg-success-soft p-4 text-[15px] text-success"
        >
          {refund.notice}
        </p>
      )}
      {query.error && <FlowError error={query.error} />}
      <OrderTicketsCard order={order} refund={refund} onShow={setQrTicket} />
      {refund.active ? (
        <button
          type="button"
          className={PRIMARY}
          disabled={count === 0 || refund.busy}
          onClick={refund.requestPreview}
        >
          {refund.previewing
            ? "Đang tính số tiền hoàn..."
            : count > 0
              ? `Xem số tiền hoàn cho ${count} vé`
              : "Chọn vé muốn hoàn"}
        </button>
      ) : action === "pay" ? (
        <Link href={`/checkout?orderId=${id}`} className={PRIMARY}>
          Tiếp tục thanh toán
        </Link>
      ) : action === "qr" ? (
        <button
          type="button"
          className={PRIMARY}
          onClick={() => setQrTicket(qrTickets[0]!.id)}
        >
          Hiện mã vào cổng
        </button>
      ) : (
        <p className="px-4 text-center text-[15px] text-muted-foreground">
          {reason}
        </p>
      )}
      {refund.previewError && <FlowError error={refund.previewError} />}
      {/* Lỗi 4xx đóng hộp thoại nên thông báo hiện tại trang. */}
      {!refund.preview && refund.submitError && (
        <FlowError error={refund.submitError} />
      )}
      <OrderDetails order={order} refund={refund} />
      <p className="pt-2 text-center text-[13px] text-muted-foreground">
        Cần hỗ trợ?{" "}
        <Link
          href="/faq"
          className="inline-flex min-h-11 items-center font-semibold underline"
        >
          Xem Trợ giúp
        </Link>
      </p>
      <RefundDialog refund={refund} />
      <TicketQrDialog
        tickets={qrTickets}
        openId={qrTicket}
        onOpenChange={setQrTicket}
        onRejected={refetch}
      />
    </div>
  );
}

export default function OrderDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  return (
    <FlowShell
      className="bg-checkout-page"
      mainClassName="max-w-132 pt-8"
      header={
        <SiteHeader
          actions={
            <>
              <MyTicketsLink current />
              <AccountMenu />
            </>
          }
        />
      }
    >
      {BuyerOrderDetailSchema.shape.id.safeParse(id).success ? (
        <OrderDetail key={id} id={id} />
      ) : (
        <p role="alert">Mã đơn hàng không hợp lệ.</p>
      )}
    </FlowShell>
  );
}
