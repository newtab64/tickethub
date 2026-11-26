/** Loai hoan tien theo API VNPay: 02 = hoan toan phan, 03 = hoan mot phan. */
export type RefundTransactionType = "02" | "03";

export interface RefundGatewayRequest {
  /** Ma yeu cau duy nhat, on dinh theo su kien outbox. */
  requestId: string;
  transactionType: RefundTransactionType;
  transactionRef: string;
  amountVnd: number;
  /** Thoi diem tao giao dich thanh toan goc, dinh dang yyyyMMddHHmmss (GMT+7). */
  transactionDate: string;
  /** Ma giao dich VNPay (vnp_TransactionNo) hoac "0" neu khong co. */
  transactionNo: string;
  createBy: string;
  orderInfo: string;
  ipAddress: string;
}

/**
 * Ket qua goi API hoan tien:
 * - SUCCESS: VNPay xac nhan hoan tien (chu ky hop le, ma 00).
 * - REJECTED: VNPay tu choi ro rang, khong hoan tien.
 * - UNREACHABLE: yeu cau chua toi VNPay (loi ket noi), an toan de thu lai.
 * - UNKNOWN: khong chac VNPay da hoan tien hay chua (timeout, phan hoi la, sai chu ky);
 *   TUYET DOI khong tu dong gui lai de tranh hoan tien hai lan.
 */
export type RefundGatewayResult =
  | { kind: "SUCCESS"; providerRefundRef: string }
  | { kind: "REJECTED"; code: string; message: string }
  | { kind: "UNREACHABLE"; reason: string }
  | { kind: "UNKNOWN"; reason: string };

export interface RefundGateway {
  refund(request: RefundGatewayRequest): Promise<RefundGatewayResult>;
}
