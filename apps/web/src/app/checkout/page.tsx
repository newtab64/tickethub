"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import { useMutation, useQuery } from "@tanstack/react-query";
import {
  CheckoutOrderSchema,
  VnpayPaymentResponseSchema,
} from "@tickethub/shared";
import { apiClient, getAccessToken } from "@/lib/api/client";
import { useSession } from "@/providers/session-provider";
import {
  remainingSeconds,
  money,
  dateTime,
  safePaymentUrl,
  orderStatusLabel,
} from "@/lib/checkout";
import { FlowShell, FlowError } from "@/components/checkout/flow-shell";
import { Button } from "@/components/ui/button";

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

  return (
    <>
      <div
        className={`sticky top-0 z-30 mb-6 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-background p-4 ${seconds !== null && seconds < 60 ? "text-destructive" : "text-foreground"}`}
      >
        <p>Thời gian giữ chỗ còn lại</p>
        <span
          role="timer"
          aria-label="Thời gian giữ chỗ"
          className="font-mono text-2xl font-bold"
        >
          {seconds === null
            ? "--:--"
            : `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`}
        </span>
        {seconds !== null && seconds < 60 && (
          <p role="alert" className="w-full text-sm">
            Phiên giữ chỗ sắp hết hạn. Thanh toán cần tối thiểu 45 giây.
          </p>
        )}
      </div>
      <div className="grid items-start gap-6 lg:grid-cols-2">
        <section
          className="space-y-6 rounded-xl border border-border bg-background p-6"
          aria-label="Thông tin thanh toán"
        >
          <h2 className="text-lg font-bold">Thông tin người nhận vé</h2>
          <p className="text-sm text-muted-foreground">
            Vé được cấp cho tài khoản đã đăng nhập.
          </p>
          <label className="block">
            Họ và tên
            <input
              className="mt-2 w-full rounded-lg border border-input bg-muted p-3"
              value={user?.fullName ?? ""}
              readOnly
              autoComplete="name"
            />
          </label>
          <label className="block">
            Email
            <input
              className="mt-2 w-full rounded-lg border border-input bg-muted p-3"
              value={user?.email ?? ""}
              readOnly
              autoComplete="email"
            />
          </label>
          <div className="space-y-2">
            <label htmlFor="voucher">Mã giảm giá</label>
            <div className="flex gap-2">
              <input
                id="voucher"
                className="min-w-0 flex-1 rounded-lg border border-input p-3"
                value={voucher}
                onChange={(e) => setVoucher(e.target.value)}
                disabled={!active}
              />
              <Button
                variant="outline"
                disabled={!active}
                onClick={() =>
                  setVoucherMessage(
                    voucher.trim()
                      ? "Chưa hỗ trợ áp dụng mã giảm giá cho đơn này. Tổng tiền vẫn theo đơn hàng trên hệ thống."
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
                  : "Chỉ áp dụng giảm giá đã được hệ thống xác nhận.")}
            </p>
          </div>
          <fieldset className="rounded-xl border border-border p-4">
            <legend className="px-2 font-bold">Phương thức thanh toán</legend>
            <label className="flex gap-2">
              <input type="radio" checked readOnly name="payment" />
              VNPay
            </label>
            <p className="mt-2 text-sm text-muted-foreground">
              Chọn VNPay-QR, thẻ ATM hoặc thẻ quốc tế tại cổng VNPay.
            </p>
          </fieldset>
          {payment.error && <FlowError error={payment.error} />}
          {cancelError !== null && <FlowError error={cancelError} />}
          <Button
            className="w-full"
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
            className="w-full"
            disabled={
              !active || payment.isPending || redirecting || cancel.isPending
            }
            onClick={() => cancel.mutate()}
          >
            {cancel.isPending ? "Đang hủy..." : "Hủy giao dịch"}
          </Button>
        </section>
        <aside
          className="space-y-5 rounded-xl border border-border bg-background p-6"
          aria-label="Tóm tắt đơn hàng"
        >
          <h2 className="text-lg font-bold">Tóm tắt đơn hàng</h2>
          <p className="font-mono text-sm">{order.orderCode}</p>
          <h3 className="text-xl font-bold">{order.event.title}</h3>
          <p>{dateTime(order.event.startTime)}</p>
          <p className="text-muted-foreground">
            {[order.event.venueName, order.event.venueAddress, order.event.city]
              .filter(Boolean)
              .join(", ")}
          </p>
          <ul className="divide-y divide-border">
            {order.items.map((item) => (
              <li key={item.id} className="space-y-2 py-4">
                <p className="font-semibold">
                  {item.ticketType.name} × {item.quantity}
                </p>
                <p className="text-sm text-muted-foreground">
                  {item.ticketType.isSeated
                    ? item.seat
                      ? `Khu ${item.seat.zoneName} - Hàng ${item.seat.rowLabel} - Ghế ${item.seat.seatNumber}`
                      : "Vị trí ghế chưa được xác nhận"
                    : `Khu vực: ${item.ticketType.name} (Vé đứng)`}
                </p>
                <p>{money(item.unitPrice)} / vé</p>
                <p>{money(item.subtotal)}</p>
              </li>
            ))}
          </ul>
          <dl className="space-y-3 border-t border-border pt-4">
            <div className="flex justify-between">
              <dt>Tạm tính</dt>
              <dd>{money(order.totalAmount)}</dd>
            </div>
            <div className="flex justify-between">
              <dt>Giảm giá</dt>
              <dd>{money(order.discountAmount)}</dd>
            </div>
            <div className="flex justify-between text-lg font-bold">
              <dt>Tổng thanh toán</dt>
              <dd>{money(order.finalAmount)}</dd>
            </div>
          </dl>
          <p className="text-sm text-muted-foreground">
            Thanh toán qua VNPay. Vé chính hãng được cấp sau khi hệ thống xác
            nhận thanh toán thành công.
          </p>
        </aside>
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
        <Link href="/events" className="underline">
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
