"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import { EventPoster } from "@/features/event";
import { CalendarDays, Clock3, CreditCard, MapPin } from "lucide-react";
import { useMutation, useQuery } from "@tanstack/react-query";
import {
  CheckoutOrderSchema,
  VnpayPaymentResponseSchema,
} from "@tickethub/shared";
import { apiClient, getAccessToken } from "@/shared/api/client";
import { useSession } from "@/features/identity";
import {
  remainingSeconds,
  money,
  dateTime,
  safePaymentUrl,
  orderStatusLabel,
} from "../domain/order-checkout";
import { FlowShell, FlowError } from "@/shared/ui/flow-shell";
import { Button } from "@/shared/ui/button";

function Checkout({ orderId }: { orderId: string }) {
  const router = useRouter();
  const { user } = useSession();
  const [now, setNow] = useState(Date.now);
  const [deadline, setDeadline] = useState<number | null>(null);
  const [cancelError, setCancelError] = useState<unknown>(null);
  const [voucher, setVoucher] = useState("");
  const [voucherMessage, setVoucherMessage] = useState("");
  const [redirecting, setRedirecting] = useState(false);
  const leavingForPayment = useRef(false);
  const releasing = useRef(false);
  const cleanupTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const query = useQuery({
    queryKey: ["checkout", orderId],
    queryFn: async () => {
      const order = CheckoutOrderSchema.parse(
        await apiClient<unknown>(
          `/booking/orders/${encodeURIComponent(orderId)}`,
        ),
      );
      // Không cho đồng hồ máy khách kéo dài thời gian giữ chỗ của server.
      setDeadline(
        Math.min(
          Date.parse(order.expiresAt),
          Date.now() + order.remainingSeconds * 1000,
        ),
      );
      return order;
    },
    retry: false,
    refetchOnWindowFocus: false,
  });
  const order = query.data;
  const seconds = deadline === null ? null : remainingSeconds(deadline, now);
  const active = order?.status === "PENDING" && seconds !== null && seconds > 0;

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!order || order.status !== "PENDING") return;
    if (cleanupTimer.current) clearTimeout(cleanupTimer.current);
    const releaseOnLeave = () => {
      if (leavingForPayment.current || releasing.current) return;
      // F5, HMR và thay đổi query không rời đơn checkout hiện tại.
      // Chỉ giải phóng khi thực sự chuyển sang một trang/đơn khác.
      const current = new URL(window.location.href);
      if (
        current.pathname === "/checkout" &&
        current.searchParams.get("orderId") === order.id
      )
        return;
      const token = getAccessToken();
      if (!token) return;
      void fetch("/api/v1/booking/release", {
        method: "POST",
        keepalive: true,
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ orderId: order.id }),
      }).catch(() => {
        /* Backend vẫn thu hồi khi hết hạn nếu trình duyệt đóng đột ngột. */
      });
    };
    // Không hủy trên pagehide: trình duyệt cũng phát sự kiện này khi F5.
    // Đóng tab/thoát trình duyệt được backend thu hồi theo hạn giữ chỗ.
    window.addEventListener("popstate", releaseOnLeave);
    return () => {
      window.removeEventListener("popstate", releaseOnLeave);
      // Hoãn để lần mount kiểm tra của React Strict Mode không hủy đơn thật.
      cleanupTimer.current = setTimeout(releaseOnLeave, 0);
    };
  }, [order]);

  useEffect(() => {
    if (
      !order ||
      order.status !== "PENDING" ||
      seconds !== 0 ||
      releasing.current ||
      leavingForPayment.current
    )
      return;
    releasing.current = true;
    void apiClient("/booking/release", {
      method: "POST",
      body: JSON.stringify({ orderId: order.id }),
    })
      .catch(() => undefined)
      .finally(() =>
        router.replace(`/events/${order.event.slug}?holdExpired=1`),
      );
  }, [order, seconds, router]);

  const payment = useMutation({
    mutationFn: async () => {
      if (
        !order ||
        !active ||
        deadline === null ||
        remainingSeconds(deadline) <= 45
      )
        throw new Error(
          "Còn dưới 45 giây giữ chỗ. Vui lòng đặt vé lại để thanh toán an toàn.",
        );
      const response = VnpayPaymentResponseSchema.parse(
        await apiClient<unknown>(`/payments/orders/${order.id}/vnpay`, {
          method: "POST",
          headers: { "Idempotency-Key": `vnpay:${order.id}` },
          body: "{}",
        }),
      );
      if (
        response.orderId !== order.id ||
        response.amountVnd !== order.finalAmount
      )
        throw new Error("Thông tin thanh toán không khớp đơn hàng.");
      const url = safePaymentUrl(response.paymentUrl);
      // Chỉ lưu định danh điều hướng; trạng thái và số tiền luôn đọc lại từ API.
      sessionStorage.setItem(
        "tickethub:payment-return",
        JSON.stringify({
          orderId: order.id,
          transactionRef: response.transactionRef,
        }),
      );
      leavingForPayment.current = true;
      setRedirecting(true);
      window.location.assign(url);
    },
    onError: () => {
      leavingForPayment.current = false;
      setRedirecting(false);
    },
  });
  const cancel = useMutation({
    mutationFn: async () => {
      if (!order) return;
      releasing.current = true;
      try {
        await apiClient("/booking/release", {
          method: "POST",
          body: JSON.stringify({ orderId: order.id }),
        });
        router.replace(`/events/${order.event.slug}`);
      } catch (error) {
        releasing.current = false;
        throw error;
      }
    },
    onError: setCancelError,
  });

  if (query.isPending) return <p role="status">Đang tải đơn giữ chỗ...</p>;
  if (query.error)
    return (
      <>
        <FlowError error={query.error} />
        <Button className="mt-4" onClick={() => query.refetch()}>
          Thử lại
        </Button>
      </>
    );
  if (!order) return null;
  if (order.status !== "PENDING")
    return (
      <div className="space-y-4">
        <p>{orderStatusLabel[order.status]}</p>
        <Link className="underline" href={`/buyer/orders/${order.id}`}>
          Xem đơn hàng
        </Link>
      </div>
    );

  const expiring = seconds !== null && seconds < 60;
  return (
    <>
      <div
        className={`sticky top-0 z-30 mb-5 flex flex-wrap items-center justify-between gap-x-3 gap-y-2 rounded-xl border bg-background px-4 py-3 sm:px-5 ${expiring ? "border-destructive/25 text-destructive" : "border-border text-foreground"}`}
      >
        <p className="flex items-center gap-2.5 text-sm font-semibold">
          <Clock3 aria-hidden="true" className="size-5" />
          Thời gian giữ chỗ
        </p>
        <span
          role="timer"
          aria-label="Thời gian giữ chỗ"
          className={`rounded-lg px-3 py-1 font-sans text-2xl leading-none font-bold tracking-tight tabular-nums sm:text-[28px] ${expiring ? "bg-destructive/10" : "bg-accent text-accent-foreground"}`}
        >
          {seconds === null
            ? "--:--"
            : `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`}
        </span>
        {expiring && (
          <p role="alert" className="w-full text-sm">
            Phiên giữ chỗ sắp hết hạn. Bạn cần còn hơn 45 giây để sang VNPay.
          </p>
        )}
      </div>
      <div className="grid grid-cols-1 items-start gap-3 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)] lg:gap-8">
        <aside
          className="grid grid-cols-[4.5rem_minmax(0,1fr)] gap-x-3 overflow-hidden rounded-xl border border-border bg-background lg:col-start-2 lg:row-start-1 lg:grid-cols-1 lg:gap-x-0"
          aria-label="Tóm tắt đơn hàng"
        >
          <div className="relative mt-3 ml-3 size-[3.75rem] overflow-hidden rounded-md bg-muted lg:m-0 lg:aspect-[16/7] lg:h-auto lg:w-full lg:rounded-none">
            <EventPoster
              event={order.event}
              sizes="(min-width: 1024px) 530px, 60px"
              labeled
            />
          </div>
          <div className="min-w-0 space-y-1 py-3 pr-3 lg:space-y-3 lg:border-b lg:border-border lg:bg-muted lg:px-6 lg:py-5">
            <div className="flex flex-wrap items-baseline justify-between gap-x-2 gap-y-0.5">
              <h2 className="text-xs font-semibold lg:text-sm">
                Tóm tắt đơn hàng
              </h2>
              <p className="text-xs text-muted-foreground">{order.orderCode}</p>
            </div>
            <h3 className="text-sm leading-snug font-bold tracking-tight lg:text-xl">
              {order.event.title}
            </h3>
            <div className="space-y-1 text-xs text-muted-foreground lg:space-y-2 lg:text-sm">
              <p className="flex items-center gap-2">
                <CalendarDays
                  aria-hidden="true"
                  className="size-3.5 shrink-0 lg:size-4"
                />
                <time dateTime={order.event.startTime}>
                  {dateTime(order.event.startTime)}
                </time>
              </p>
              <p className="flex items-start gap-2">
                <MapPin
                  aria-hidden="true"
                  className="mt-0.5 size-3.5 shrink-0 lg:size-4"
                />
                <span>
                  {[order.event.venueName, order.event.city]
                    .filter(Boolean)
                    .join(", ")}
                  {order.event.venueAddress && (
                    <span className="hidden lg:inline">
                      {" "}
                      · {order.event.venueAddress}
                    </span>
                  )}
                </span>
              </p>
            </div>
          </div>
          <div className="col-span-full mx-3 border-t border-border pb-3 lg:mx-0 lg:border-t-0 lg:px-6 lg:pb-5">
            <ul className="divide-y divide-border">
              {order.items.map((item) => (
                <li
                  key={item.id}
                  className="grid grid-cols-[minmax(0,1fr)_auto] gap-x-3 gap-y-0.5 py-2 lg:gap-y-1 lg:py-4"
                >
                  <p className="text-sm font-semibold">
                    {item.ticketType.name} × {item.quantity}
                  </p>
                  <p className="col-span-2 row-start-2 text-xs text-muted-foreground">
                    {item.ticketType.isSeated
                      ? item.seat
                        ? `Khu ${item.seat.zoneName} - Hàng ${item.seat.rowLabel} - Ghế ${item.seat.seatNumber}`
                        : "Vị trí ghế chưa được xác nhận"
                      : `Khu vực: ${item.ticketType.name} (Vé đứng)`}
                  </p>
                  <p className="col-span-2 text-xs text-muted-foreground">
                    {money(item.unitPrice)} / vé
                  </p>
                  <p className="col-start-2 row-start-1 text-sm font-semibold tabular-nums">
                    {money(item.subtotal)}
                  </p>
                </li>
              ))}
            </ul>
            <dl className="space-y-1 border-t border-border pt-2 text-xs tabular-nums lg:space-y-2 lg:pt-4 lg:text-sm">
              <div className="flex justify-between">
                <dt>Tạm tính</dt>
                <dd>{money(order.totalAmount)}</dd>
              </div>
              <div className="flex justify-between">
                <dt>Giảm giá</dt>
                <dd>{money(order.discountAmount)}</dd>
              </div>
              <div className="mt-2 flex justify-between gap-3 border-t border-border pt-2 text-sm font-bold lg:mt-3 lg:pt-3 lg:text-base">
                <dt>Tổng thanh toán</dt>
                <dd className="text-primary">{money(order.finalAmount)}</dd>
              </div>
            </dl>
          </div>
        </aside>
        <section
          className="space-y-5 rounded-xl border border-border bg-background p-4 sm:p-6 lg:col-start-1 lg:row-start-1"
          aria-label="Thông tin thanh toán"
        >
          <h2 className="text-lg font-bold tracking-tight">
            Thông tin nhận vé
          </h2>
          <dl className="grid grid-cols-1 gap-3 rounded-xl bg-muted p-4 sm:grid-cols-2">
            <div className="min-w-0">
              <dt className="mb-1 text-xs text-muted-foreground">Họ và tên</dt>
              <dd className="text-sm font-semibold break-words">
                {user?.fullName || "Chưa cập nhật"}
              </dd>
            </div>
            <div className="min-w-0">
              <dt className="mb-1 text-xs text-muted-foreground">Email</dt>
              <dd className="text-sm font-semibold break-all">
                {user?.email || "Chưa cập nhật"}
              </dd>
            </div>
          </dl>
          <div className="space-y-2">
            <label htmlFor="voucher" className="text-sm font-semibold">
              Mã giảm giá
            </label>
            <div className="flex gap-2">
              <input
                id="voucher"
                className="h-11 min-w-0 flex-1 rounded-lg border border-input px-3 text-sm focus-visible:outline-2 focus-visible:outline-ring"
                value={voucher}
                onChange={(e) => setVoucher(e.target.value)}
                disabled={!active}
              />
              <Button
                variant="outline"
                className="h-11 px-4"
                disabled={!active}
                onClick={() =>
                  setVoucherMessage(
                    voucher.trim()
                      ? "Chưa hỗ trợ áp dụng mã giảm giá cho đơn này."
                      : "Vui lòng nhập mã giảm giá.",
                  )
                }
              >
                Kiểm tra
              </Button>
            </div>
            <p role="status" className="text-sm text-muted-foreground">
              {voucherMessage ||
                (order.voucherCode
                  ? `Mã đã áp dụng: ${order.voucherCode}`
                  : null)}
            </p>
          </div>
          <div className="border-t border-border pt-5">
            <h3 className="mb-3 text-sm font-semibold">
              Phương thức thanh toán
            </h3>
            <div className="flex items-center gap-3 rounded-xl border border-border p-3">
              <CreditCard
                aria-hidden="true"
                className="size-5 shrink-0 text-primary"
              />
              <div>
                <p className="text-sm font-semibold">VNPay</p>
                <p className="text-xs text-muted-foreground">
                  Chọn QR, thẻ ATM hoặc thẻ quốc tế trên VNPay.
                </p>
              </div>
            </div>
          </div>
          {payment.error && <FlowError error={payment.error} />}
          {cancelError !== null && <FlowError error={cancelError} />}
          <Button
            className="h-11 w-full font-semibold"
            disabled={
              !active ||
              seconds === null ||
              seconds <= 45 ||
              payment.isPending ||
              redirecting ||
              cancel.isPending
            }
            onClick={() => payment.mutate()}
          >
            {payment.isPending || redirecting
              ? "Đang chuyển tới VNPay..."
              : "Thanh toán ngay qua VNPay"}
          </Button>
          <Button
            variant="outline"
            className="h-11 w-full font-semibold"
            disabled={
              !active || payment.isPending || redirecting || cancel.isPending
            }
            onClick={() => cancel.mutate()}
          >
            {cancel.isPending ? "Đang hủy..." : "Hủy giao dịch"}
          </Button>
        </section>
      </div>
    </>
  );
}
function CheckoutRoute() {
  const params = useSearchParams();
  const orderId = params.get("orderId");
  if (
    !orderId ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
      orderId,
    )
  )
    return (
      <p role="alert">
        Không có mã đơn hàng hợp lệ.{" "}
        <Link href="/" className="underline">
          Chọn sự kiện để đặt vé
        </Link>
        .
      </p>
    );
  return <Checkout key={orderId} orderId={orderId} />;
}
export default function CheckoutPage() {
  return (
    <FlowShell title="Thanh toán">
      <Suspense fallback={<p>Đang tải...</p>}>
        <CheckoutRoute />
      </Suspense>
    </FlowShell>
  );
}
