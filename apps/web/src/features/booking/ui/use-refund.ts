"use client";

import { useRef, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import {
  RefundPreviewResponseSchema,
  RefundExecuteRequestSchema,
  RefundExecuteResponseSchema,
  type RefundPreviewResponse,
  type RefundExecuteRequest,
} from "@tickethub/shared";
import { apiClient, ApiError } from "@/shared/api/client";
import { money } from "@/features/payment";

/** Chon ve, xem truoc va gui yeu cau hoan tien cho mot don. */
export function useRefund(orderId: string, refetch: () => void) {
  const [active, setActive] = useState(false);
  const [selected, setSelected] = useState<string[]>([]);
  const [reason, setReason] = useState("");
  const [preview, setPreview] = useState<RefundPreviewResponse | null>(null);
  const [notice, setNotice] = useState("");
  const [uncertain, setUncertain] = useState(false);
  const pendingRequest = useRef<{
    key: string;
    body: RefundExecuteRequest;
  } | null>(null);
  const previewMutation = useMutation({
    mutationFn: async () =>
      RefundPreviewResponseSchema.parse(
        await apiClient<unknown>("/refund/preview", {
          method: "POST",
          body: JSON.stringify({ orderId, ticketIds: selected }),
        }),
      ),
    onSuccess: (data) => {
      setPreview(data);
      setNotice("");
    },
  });
  const refund = useMutation({
    mutationFn: async () => {
      if (!preview || preview.totalRefundAmount <= 0)
        throw new Error("Vui lòng xem trước số tiền hoàn trước khi xác nhận.");
      if (!pendingRequest.current)
        pendingRequest.current = {
          key: crypto.randomUUID(),
          body: RefundExecuteRequestSchema.parse({
            orderId,
            ticketIds: selected,
            reason: reason.trim(),
          }),
        };
      const pending = pendingRequest.current;
      return RefundExecuteResponseSchema.parse(
        await apiClient<unknown>("/refund/request", {
          method: "POST",
          headers: { "Idempotency-Key": pending.key },
          body: JSON.stringify(pending.body),
        }),
      );
    },
    onSuccess: (data) => {
      setNotice(
        `Đã tiếp nhận yêu cầu hủy ${data.cancelledTicketCount} vé, số tiền hoàn ${money(data.refundAmount)}. Tiền hoàn đang được xử lý.`,
      );
      pendingRequest.current = null;
      setUncertain(false);
      setSelected([]);
      setPreview(null);
      setReason("");
      setActive(false);
      refetch();
    },
    onError: (error) => {
      if (
        error instanceof ApiError &&
        error.status >= 400 &&
        error.status < 500
      ) {
        pendingRequest.current = null;
        setUncertain(false);
        setPreview(null);
        refetch();
      } else if (pendingRequest.current) setUncertain(true);
    },
  });
  const busy = previewMutation.isPending || refund.isPending || uncertain;
  const clear = () => {
    setPreview(null);
    previewMutation.reset();
    refund.reset();
  };
  return {
    active,
    selected,
    reason,
    setReason,
    preview,
    notice,
    uncertain,
    busy,
    previewing: previewMutation.isPending,
    submitting: refund.isPending,
    previewError: previewMutation.error,
    submitError: refund.error,
    setActive: (value: boolean) => {
      if (busy) return;
      setActive(value);
      setSelected([]);
      clear();
    },
    toggle: (ticketId: string, checked: boolean) => {
      setSelected((current) =>
        checked
          ? [...current, ticketId]
          : current.filter((value) => value !== ticketId),
      );
      clear();
    },
    requestPreview: () => {
      setPreview(null);
      previewMutation.mutate();
    },
    /** Chua biet ket qua thi khong cho dong, tranh tao yeu cau thu hai. */
    closePreview: () => {
      if (!refund.isPending && !uncertain) setPreview(null);
    },
    confirm: () => refund.mutate(),
  };
}

export type Refund = ReturnType<typeof useRefund>;
