const PLACEHOLDER_VALUES = new Set(["TEST_TMN_CODE", "TEST_HASH_SECRET", ""]);

export interface RefundProcessorEnv {
  ENABLE_VNPAY_REFUND_PROCESSING?: string | undefined;
  VNPAY_TMN_CODE: string;
  VNPAY_HASH_SECRET: string;
}

/** Chi cho phep chay tien trinh hoan tien khi duoc bat tuong minh va co thong tin VNPay that. */
export function assertRefundProcessingAllowed(env: RefundProcessorEnv): void {
  if (env.ENABLE_VNPAY_REFUND_PROCESSING !== "true") {
    throw new Error(
      "Refund processing is disabled. Set ENABLE_VNPAY_REFUND_PROCESSING=true to run it",
    );
  }
  if (
    PLACEHOLDER_VALUES.has(env.VNPAY_TMN_CODE) ||
    PLACEHOLDER_VALUES.has(env.VNPAY_HASH_SECRET)
  ) {
    throw new Error(
      "Refusing to run refund processing with placeholder VNPay credentials",
    );
  }
}
