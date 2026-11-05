"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useRouter, useSearchParams } from "next/navigation";
import { HoldSeatsResponseDataSchema } from "@tickethub/shared";
import { getPublicEvent } from "@/lib/api/events";
import { apiClient, ApiError } from "@/lib/api/client";
import { money, dateTime } from "@/lib/checkout";
import { FlowShell, FlowError } from "@/components/checkout/flow-shell";
import { Button } from "@/components/ui/button";

export function LiveEvent({
  identifier,
  booking = false,
}: {
  identifier: string;
  booking?: boolean;
}) {
  const router = useRouter();
  const params = useSearchParams();
  const [quantity, setQuantity] = useState(1);
  const [ticketTypeId, setTicketTypeId] = useState("");
  const [now, setNow] = useState(Date.now);
  const query = useQuery({
    queryKey: ["public-event", identifier],
    queryFn: () => getPublicEvent(identifier),
    retry: false,
    refetchInterval: booking ? 10000 : false,
  });
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);
  const event = query.data;
  const selected = event?.ticketTypes.find((item) => item.id === ticketTypeId);
  const available = selected
    ? Math.max(0, selected.capacity - selected.heldCount - selected.soldCount)
    : 0;
  const canBook =
    selected &&
    quantity >= 1 &&
    quantity <= Math.min(6, selected.maxPerOrder, available) &&
    now >= Date.parse(selected.saleStartTime) &&
    now < Date.parse(selected.saleEndTime);
  const hold = useMutation({
    mutationFn: async () => {
      if (!event || !selected || !canBook)
        throw new Error("Vui lòng chọn hạng vé và số lượng còn mở bán.");
      return HoldSeatsResponseDataSchema.parse(
        await apiClient<unknown>("/booking/hold", {
          method: "POST",
          body: JSON.stringify({
            eventId: event.id,
            items: [{ ticketTypeId: selected.id, quantity }],
          }),
        }),
      );
    },
    onSuccess: (order) => router.push(`/checkout?orderId=${order.orderId}`),
    onError: (error) => {
      if (error instanceof ApiError && error.status === 401) {
        router.push(
          `/auth?redirect=${encodeURIComponent(`/events/${identifier}/booking`)}`,
        );
      }
      void query.refetch();
    },
  });
  return (
    <FlowShell
      title={booking ? "Chọn khu vực và số lượng vé" : "Chi tiết sự kiện"}
    >
      {params.get("holdExpired") === "1" && (
        <p
          role="alert"
          className="mb-5 rounded-xl bg-accent p-4 text-accent-foreground"
        >
          Phiên giữ chỗ đã hết hạn. Vui lòng chọn lại khu vực và số lượng vé.
        </p>
      )}
      {query.isPending && <p role="status">Đang tải sự kiện...</p>}
      {query.error && (
        <div className="space-y-4">
          <FlowError error={query.error} />
          <p>
            Sự kiện có thể chưa được mở bán hoặc đường dẫn không còn hợp lệ.
            Danh mục minh họa trước đây không phải dữ liệu trong database.
          </p>
          <Link href="/events" className="text-primary underline">
            Xem sự kiện đang mở bán
          </Link>
          <Button variant="outline" onClick={() => query.refetch()}>
            Thử lại
          </Button>
        </div>
      )}
      {event && (
        <div className="grid items-start gap-6 lg:grid-cols-2">
          <section className="space-y-4 rounded-xl border border-border bg-background p-6">
            <h2 className="text-2xl font-bold">{event.title}</h2>
            <p>{dateTime(event.startTime)}</p>
            <p className="text-muted-foreground">
              {event.venueName} · {event.venueAddress} · {event.city}
            </p>
            <p className="whitespace-pre-line">{event.description}</p>
            <p>Mở cửa: {dateTime(event.gateOpeningTime)}</p>
            <Link className="block text-primary underline" href="/events">
              Tất cả sự kiện đang mở bán
            </Link>
            {!booking && (
              <Button asChild>
                <Link href={`/events/${event.slug}/booking`}>Mua vé ngay</Link>
              </Button>
            )}
          </section>
          <section
            className="space-y-4 rounded-xl border border-border bg-background p-6"
            aria-label="Các khu vực vé"
          >
            <h2 className="text-lg font-bold">
              {booking ? "Chọn hạng vé" : "Hạng vé mở bán"}
            </h2>
            <p className="text-sm text-muted-foreground">
              Chọn khu vực và số lượng. Ghế được hệ thống tự động phân bổ; vé
              đứng được quản lý theo sức chứa.
            </p>
            {event.ticketTypes.length === 0 && (
              <p>Chưa có hạng vé được công bố.</p>
            )}
            <fieldset disabled={hold.isPending}>
              <legend className="sr-only">Khu vực vé</legend>
              <div className="grid gap-3 sm:grid-cols-2">
                {event.ticketTypes.map((item) => {
                  const count = Math.max(
                    0,
                    item.capacity - item.heldCount - item.soldCount,
                  );
                  const onSale =
                    now >= Date.parse(item.saleStartTime) &&
                    now < Date.parse(item.saleEndTime);
                  return (
                    <label
                      key={item.id}
                      className={`space-y-2 rounded-xl border p-4 ${ticketTypeId === item.id ? "border-primary bg-accent" : "border-border"}`}
                    >
                      {booking && (
                        <input
                          type="radio"
                          name="ticketType"
                          value={item.id}
                          checked={ticketTypeId === item.id}
                          disabled={count === 0 || !onSale}
                          onChange={() => {
                            setTicketTypeId(item.id);
                            setQuantity(1);
                            hold.reset();
                          }}
                        />
                      )}
                      <span className="ml-2 font-bold">{item.name}</span>
                      <span className="block">{money(item.price)} / vé</span>
                      <span className="block text-sm">
                        {item.isSeated ? "Ghế được phân bổ tự động" : "Vé đứng"}
                      </span>
                      <span className="block text-sm text-muted-foreground">
                        {!onSale
                          ? "Ngoài thời gian mở bán"
                          : count === 0
                            ? "Hết vé"
                            : count < 10
                              ? `Sắp hết vé: còn ${count}`
                              : `Còn ${count} vé`}
                      </span>
                    </label>
                  );
                })}
              </div>
            </fieldset>
            {booking && (
              <>
                <label className="block">
                  Số lượng vé
                  <select
                    className="ml-3 rounded-lg border border-input bg-background p-2"
                    value={quantity}
                    disabled={!selected || hold.isPending}
                    onChange={(e) => setQuantity(Number(e.target.value))}
                  >
                    {Array.from(
                      {
                        length: Math.max(
                          1,
                          Math.min(
                            6,
                            selected?.maxPerOrder ?? 6,
                            available || 1,
                          ),
                        ),
                      },
                      (_, i) => i + 1,
                    ).map((n) => (
                      <option value={n} key={n}>
                        {n} vé
                      </option>
                    ))}
                  </select>
                </label>
                {selected && (
                  <p className="font-bold">
                    Tạm tính: {money(selected.price * quantity)}
                  </p>
                )}
                {hold.error && <FlowError error={hold.error} />}
                <Button
                  className="w-full"
                  disabled={!canBook || hold.isPending || hold.isSuccess}
                  onClick={() => hold.mutate()}
                >
                  {hold.isPending || hold.isSuccess
                    ? "Đang chuyển tới checkout..."
                    : "Giữ chỗ và tiếp tục"}
                </Button>
              </>
            )}
          </section>
        </div>
      )}
    </FlowShell>
  );
}
