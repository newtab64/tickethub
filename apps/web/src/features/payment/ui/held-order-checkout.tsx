"use client";

import { Suspense, useEffect, useRef, useState, type ReactNode } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import { ShieldCheck } from "lucide-react";
import { getEventById } from "@/features/event";
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
import { FlowShell, FlowError } from "@/shared/ui/flow-shell";
import { Button } from "@/shared/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
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
      <h1 className="text-2xl font-bold tracking-tight">Thanh toán</h1>
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
  // Trang sự kiện hiện chỉ có danh mục tĩnh, đơn ngoài danh mục về trang chủ.
  const eventPath =
    order && getEventById(order.event.id) ? `/events/${order.event.id}` : "/";
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
      <div className="grid grid-cols-1 rounded-3xl border border-checkout-border bg-background py-2 text-sm shadow-sheet lg:grid-cols-2 lg:grid-rows-[repeat(4,auto)] lg:py-3 short:py-2">
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
                <div ref={scrollToError} className="mb-3 scroll-mb-24">
                  <FlowError error={paymentError} />
                </div>
              )}
              {cancelError !== null && (
                <div className="mb-3">
                  <FlowError error={cancelError} />
                </div>
              )}
            </>
          }
        />
      </div>
      <p className="mt-3.5 text-center text-xs text-muted-foreground short:mt-2">
        <ShieldCheck
          aria-hidden="true"
          className="mr-1.5 inline size-4 align-[-3px] text-primary"
        />
        Vé chính hãng. Nếu đã trừ tiền mà không thể cấp vé, hệ thống hoàn tiền
        cho bạn.
      </p>
      {/* Mép thanh trùng mép các khối trong thẻ: lề trang + viền 1px + đệm khối. */}
      <div
        data-testid="mobile-pay-bar"
        className={`fixed inset-x-[33px] bottom-3 z-30 flex h-14 items-center justify-between gap-3 rounded-full bg-pay-bar pr-2 pl-5 sm:inset-x-[41px] shadow-pay-bar transition-[translate,visibility] lg:hidden ${payButtonVisible ? "invisible translate-y-[140%]" : ""}`}
      >
        <p className="flex flex-col text-[11px] leading-[14px] text-pay-bar-muted">
          Tổng thanh toán
          <strong className="text-lg leading-[22px] text-white tabular-nums">
            {money(order.finalAmount)}
          </strong>
        </p>
        <Button
          className="h-10 rounded-full bg-background px-5 font-semibold text-accent-foreground hover:bg-background/90"
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
        <DialogContent showCloseButton={false}>
          <DialogTitle>Hủy giữ chỗ?</DialogTitle>
          <DialogDescription>
            Vé đang giữ sẽ được trả lại kho để người khác đặt mua.
          </DialogDescription>
          <DialogFooter>
            <Button variant="outline" onClick={() => setLeaveRequest(null)}>
              Ở lại thanh toán
            </Button>
            <Button variant="destructive" onClick={confirmLeave}>
              Hủy giữ chỗ
            </Button>
          </DialogFooter>
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
      className="bg-checkout-page"
      mainClassName="pt-3 pb-6 sm:pt-6 short:pt-3.5"
      footer={<CheckoutFooter />}
    >
      <Suspense fallback={<CheckoutNotice>Đang tải...</CheckoutNotice>}>
        <CheckoutRoute />
      </Suspense>
    </FlowShell>
  );
}
