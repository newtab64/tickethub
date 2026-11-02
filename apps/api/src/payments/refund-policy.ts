import {
  EventStatus,
  OrderStatus,
  RefundPolicyType,
  TicketStatus,
} from "@tickethub/shared";

export type RefundPolicyDecision =
  | {
      decision: "ELIGIBLE";
      refundPercentage: number;
      reason: string;
    }
  | {
      decision: "DENIED" | "REVIEW_REQUIRED";
      refundPercentage: 0;
      reason: string;
    };

interface RefundRule {
  minHoursBeforeStart: number;
  refundPercent: number;
}

export interface RefundPolicyInput {
  orderStatus: OrderStatus;
  ticketStatus: TicketStatus;
  eventStatus: EventStatus;
  policyType: RefundPolicyType;
  rawRules: unknown;
  eventStart: Date;
  now: Date;
}

function reject(
  decision: "DENIED" | "REVIEW_REQUIRED",
  reason: string,
): RefundPolicyDecision {
  return {
    decision,
    refundPercentage: 0,
    reason,
  };
}

export function evaluateRefundPolicy(
  input: RefundPolicyInput,
): RefundPolicyDecision {
  // 1. Chi hoan don da thanh toan
  if (input.orderStatus !== OrderStatus.PAID) {
    return reject("DENIED", "ORDER_NOT_PAID");
  }

  // 2. Ve da check-in khong duoc tu dong hoan
  if (input.ticketStatus !== TicketStatus.SOLD) {
    return reject("DENIED", "TICKET_NOT_REFUNDABLE");
  }

  // 3. Su kien huy/hoan: can chinh sach rieng
  if (
    input.eventStatus === EventStatus.CANCELLED ||
    input.eventStatus === EventStatus.SUSPENDED
  ) {
    return reject("REVIEW_REQUIRED", "EVENT_REQUIRES_SPECIAL_REFUND");
  }

  // 4. Kiem tra thoi gian
  const now = input.now.getTime();
  const start = input.eventStart.getTime();

  if (!Number.isFinite(now) || !Number.isFinite(start)) {
    return reject("REVIEW_REQUIRED", "INVALID_EVENT_DATE");
  }

  if (now >= start) {
    return reject("DENIED", "EVENT_ALREADY_STARTED");
  }

  // 5. Khong cho phep hoan theo chinh sach
  if (input.policyType === RefundPolicyType.NO_REFUND) {
    return reject("DENIED", "NO_REFUND_POLICY");
  }

  // 6. Khong tu suy doan ty le neu chua cau hinh
  if (!Array.isArray(input.rawRules) || input.rawRules.length === 0) {
    return reject("REVIEW_REQUIRED", "REFUND_POLICY_NOT_CONFIGURED");
  }

  const rules: RefundRule[] = [];
  const thresholds = new Set<number>();

  // 7. Validate JSONB tu database
  for (const item of input.rawRules) {
    if (!item || typeof item !== "object" || Array.isArray(item)) {
      return reject("REVIEW_REQUIRED", "INVALID_POLICY_RULE");
    }

    const rule = item as Record<string, unknown>;
    const hours = rule.minHoursBeforeStart;
    const percent = rule.refundPercent;

    if (
      typeof hours !== "number" ||
      !Number.isSafeInteger(hours) ||
      hours < 0 ||
      typeof percent !== "number" ||
      !Number.isInteger(percent) ||
      percent < 0 ||
      percent > 100
    ) {
      return reject("REVIEW_REQUIRED", "INVALID_POLICY_RULE");
    }

    if (thresholds.has(hours)) {
      return reject("REVIEW_REQUIRED", "DUPLICATE_POLICY_RULE");
    }

    thresholds.add(hours);

    rules.push({
      minHoursBeforeStart: hours,
      refundPercent: percent,
    });
  }

  // 8. Tinh thoi gian con lai truoc su kien
  const hoursRemaining = (start - now) / 3_600_000;

  // Chon moc lon nhat ma thoi gian con lai dat duoc
  const matchingRule = rules
    .filter((rule) => hoursRemaining >= rule.minHoursBeforeStart)
    .sort((a, b) => b.minHoursBeforeStart - a.minHoursBeforeStart)[0];

  if (!matchingRule || matchingRule.refundPercent === 0) {
    return reject("DENIED", "OUTSIDE_REFUND_WINDOW");
  }

  return {
    decision: "ELIGIBLE",
    refundPercentage: matchingRule.refundPercent,
    reason: `REFUND_BEFORE_${matchingRule.minHoursBeforeStart}H`,
  };
}
