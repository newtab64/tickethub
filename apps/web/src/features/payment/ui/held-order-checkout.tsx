"use client";

import { Suspense, useEffect, useRef, useState, type ReactNode } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import { useMutation, useQuery } from "@tanstack/react-query";
import {
  CheckoutOrderSchema,
  VnpayPaymentResponseSchema,
} from "@tickethub/shared";
import { ApiError, apiClient, getAccessToken } from "@/shared/api/client";
import {
  remainingSeconds,
  money,
  safePaymentUrl,
  orderStatusLabel,
  paymentFailureMessage,
} from "../domain/order-checkout";
import { HeaderActions } from "@/features/identity";
import { SiteHeader } from "@/shared/ui/site-header";
import { FlowShell, FlowError } from "@/shared/ui/flow-shell";
import { Button } from "@/shared/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/shared/ui/dialog";
import { CheckoutFooter } from "./checkout-footer";
import { CheckoutTitleRow } from "./checkout-title-row";
import { OrderSummary } from "./order-summary";
import { PaymentPanel } from "./payment-panel";

// Khai báo ngoài component để ref chỉ cuộn khi lỗi xuất hiện, không theo nhịp đồng hồ.
const scrollToError = (node: HTMLElement | null) =>
  node?.scrollIntoView({ block: "nearest" });

/** Tiêu đề cho các trạng thái chưa có thẻ thanh toán. */
function CheckoutNotice({ children }: { children: ReactNode }) {
  return (
    <div className="space-y-4">
      <h1 className="text-[28px] font-semibold tracking-tight">Thanh toán</h1>
      {children}
    </div>
  );
}

function Checkout({ orderId }: { orderId: string }) {
  const router = useRouter();
  const [now, setNow] = useState(Date.now);
  const [cancelError, setCancelError] = useState<unknown>(null);
  const [redirecting, setRedirecting] = useState(false);
  // null: đóng hộp xác nhận; href null: bấm hủy, không phải bấm liên kết.
  const [leaveRequest, setLeaveRequest] = useState<{
    href: string | null;
  } | null>(null);
  const [payButton, setPayButton] = useState<HTMLButtonElement | null>(null);
  const [payButtonVisible, setPayButtonVisible] = useState(false);
  const leavingForPayment = useRef(false);
  const releasing = useRef(false);
  const cleanupTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const query = useQuery({
    queryKey: ["checkout", orderId],
    queryFn: async () =>
      CheckoutOrderSchema.parse(
        await apiClient<unknown>(
          `/booking/orders/${encodeURIComponent(orderId)}`,
        ),
      ),
    retry: false,
    refetchOnWindowFocus: false,
  });
  const order = query.data;
  // Tính từ số giây server trả về: đồng hồ máy khách lệch giờ không ảnh hưởng.
  const deadline = order
    ? query.dataUpdatedAt + order.remainingSeconds * 1000
    : null;
  const seconds =
    deadline === null
      ? null
      : remainingSeconds(deadline, Math.max(now, query.dataUpdatedAt));
  const active = order?.status === "PENDING" && seconds !== null && seconds > 0;
  const eventPath = order ? `/events/${order.event.id}` : "/";
  const { refetch } = query;

  // Thanh nổi trên mobile chỉ cần khi nút thanh toán chính chưa vào màn hình.
  useEffect(() => {
    if (!payButton) return;
    const observer = new IntersectionObserver(([entry]) =>
      setPayButtonVisible(Boolean(entry?.isIntersecting)),
    );
    observer.observe(payButton);
    return () => observer.disconnect();
  }, [payButton]);

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(timer);
  }, []);

  // Bấm Back từ VNPay có thể khôi phục trang từ bfcache với nút còn bị khóa.
  useEffect(() => {
    const restore = (event: PageTransitionEvent) => {
      if (!event.persisted) return;
      leavingForPayment.current = false;
      setRedirecting(false);
      void refetch();
    };
    window.addEventListener("pageshow", restore);
    return () => window.removeEventListener("pageshow", restore);
  }, [refetch]);

  // Rời checkout sẽ trả chỗ, nên hỏi lại trước khi đi theo một liên kết.
  useEffect(() => {
    if (order?.status !== "PENDING") return;
    const askBeforeLeaving = (event: MouseEvent) => {
      if (event.button !== 0 || event.metaKey || event.ctrlKey) return;
      if (event.shiftKey || event.altKey) return;
      const link =
        event.target instanceof Element
          ? event.target.closest("a[href]")
          : null;
      if (!(link instanceof HTMLAnchorElement) || link.target === "_blank")
        return;
      if (link.href === window.location.href) return;
      event.preventDefault();
      event.stopPropagation();
      setLeaveRequest({ href: link.href });
    };
    document.addEventListener("click", askBeforeLeaving, true);
    return () => document.removeEventListener("click", askBeforeLeaving, true);
  }, [order?.status]);

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
      .finally(() => router.replace(`${eventPath}?holdExpired=1`));
  }, [order, seconds, eventPath, router]);

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
        router.replace(eventPath);
      } catch (error) {
        releasing.current = false;
        throw error;
      }
    },
    onError: setCancelError,
  });

  const payDisabled =
    !active ||
    seconds === null ||
    seconds <= 45 ||
    payment.isPending ||
    redirecting ||
    cancel.isPending;
  const paymentError =
    payment.error instanceof ApiError
      ? new ApiError(
          payment.error.status,
          payment.error.code,
          paymentFailureMessage(payment.error.status),
        )
      : payment.error;
  const confirmLeave = () => {
    const href = leaveRequest?.href;
    setLeaveRequest(null);
    // Điều hướng đi sẽ unmount trang, effect phía trên tự trả chỗ.
    if (href) router.push(href);
    else cancel.mutate();
  };

  if (query.isPending)
    return (
      <CheckoutNotice>
        <p role="status">Đang tải đơn giữ chỗ...</p>
      </CheckoutNotice>
    );
  if (query.error)
    return (
      <CheckoutNotice>
        <FlowError error={query.error} />
        <Button onClick={() => query.refetch()}>Thử lại</Button>
      </CheckoutNotice>
    );
  if (!order) return null;
  if (order.status !== "PENDING")
    return (
      <CheckoutNotice>
        <p>{orderStatusLabel[order.status]}</p>
        <Link className="underline" href={`/buyer/orders/${order.id}`}>
          Xem đơn hàng
        </Link>
      </CheckoutNotice>
    );

  const busy = payment.isPending || redirecting || cancel.isPending;
  return (
    <>
      <CheckoutTitleRow
        seconds={seconds}
        cancelDisabled={!active || busy}
        cancelling={cancel.isPending}
        onCancel={() => setLeaveRequest({ href: null })}
      />
      <div
        data-testid="checkout-sheet"
        className="flex flex-col rounded-3xl bg-background shadow-sheet lg:grid lg:grid-cols-2"
      >
        <OrderSummary order={order} />
        <PaymentPanel
          voucherCode={order.voucherCode}
          disabled={!active}
          payDisabled={payDisabled}
          paying={payment.isPending || redirecting}
          payButtonRef={setPayButton}
          onPay={() => payment.mutate()}
          error={
            <>
              {paymentError && (
                // Nút thanh toán trên mobile nằm xa vị trí lỗi.
                <div
                  ref={scrollToError}
                  className="mb-3 scroll-mt-24 scroll-mb-24"
                >
                  <FlowError error={paymentError} />
                </div>
              )}
              {cancelError !== null && (
                // Nút hủy nằm ở đầu trang, lỗi hiện cạnh nút thanh toán.
                <div
                  ref={scrollToError}
                  className="mb-3 scroll-mt-24 scroll-mb-24"
                >
                  <FlowError error={cancelError} />
                </div>
              )}
            </>
          }
        />
      </div>
      {/* Nền đen và thụt vào so với thẻ để thấy là thanh nổi. */}
      <div
        data-testid="mobile-pay-bar"
        className={`fixed inset-x-8 bottom-3 z-30 flex items-center justify-between gap-3 rounded-full bg-foreground py-2 pr-2 pl-6 shadow-sheet transition-[translate,visibility] motion-reduce:transition-none max-[389px]:gap-2 max-[389px]:pl-4 max-[359px]:inset-x-4 sm:inset-x-10 lg:hidden ${payButtonVisible ? "invisible translate-y-[140%]" : ""}`}
      >
        <p className="flex flex-col text-[13px] text-background/75">
          Tổng cộng
          <strong className="text-[17px] font-semibold whitespace-nowrap text-background tabular-nums max-[389px]:text-[15px]">
            {money(order.finalAmount)}
          </strong>
        </p>
        <Button
          size="lg"
          // Viền focus trắng mới thấy được trên nền đen.
          className="focus-visible:ring-background max-[389px]:px-4"
          disabled={payDisabled}
          onClick={() => payment.mutate()}
        >
          Thanh toán
        </Button>
      </div>
      <Dialog
        open={leaveRequest !== null}
        onOpenChange={(open) => !open && setLeaveRequest(null)}
      >
        {/* Không có nút X: "Tiếp tục thanh toán" đã làm đúng việc đó. */}
        <DialogContent showCloseButton={false} className="text-center">
          <DialogTitle>Hủy giao dịch?</DialogTitle>
          <DialogDescription>Ghế đang giữ sẽ được trả lại.</DialogDescription>
          <div className="grid gap-2 pt-2">
            <Button size="lg" onClick={() => setLeaveRequest(null)}>
              Tiếp tục thanh toán
            </Button>
            <Button size="lg" variant="destructive" onClick={confirmLeave}>
              Hủy giao dịch
            </Button>
          </div>
        </DialogContent>
      </Dialog>
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
      <CheckoutNotice>
        <p role="alert">
          Không có mã đơn hàng hợp lệ.{" "}
          <Link href="/" className="underline">
            Chọn sự kiện để đặt vé
          </Link>
          .
        </p>
      </CheckoutNotice>
    );
  return <Checkout key={orderId} orderId={orderId} />;
}
export default function CheckoutPage() {
  return (
    <FlowShell
      // Bóng của header phủ lên nền hàng tiêu đề để không lộ mép.
      header={
        <SiteHeader
          className="relative z-40"
          actions={<HeaderActions allowLogout={false} />}
        />
      }
      className="flex flex-col bg-checkout-page"
      // Còn chỗ thì nội dung nằm giữa; chân trang luôn sát đáy.
      mainClassName="flex w-full max-w-232 flex-1 flex-col justify-center pt-2 pb-6 sm:pt-6 short:pt-3"
      footer={<CheckoutFooter />}
    >
      <Suspense fallback={<CheckoutNotice>Đang tải...</CheckoutNotice>}>
        <CheckoutRoute />
      </Suspense>
    </FlowShell>
  );
}
