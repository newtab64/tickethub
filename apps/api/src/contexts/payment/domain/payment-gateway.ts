export interface CreatePaymentRequest {
  transactionRef: string;
  amountVnd: number;
  orderInfo: string;
  returnUrl: string;
  ipAddress: string;
  expiresAt?: Date;
}

export interface CreatePaymentResult {
  transactionRef: string;
  paymentUrl: string;
  /** vnp_CreateDate (yyyyMMddHHmmss, GMT+7) da gui toi cong thanh toan; can cho hoan tien sau nay. */
  createDate: string;
}

export interface VerifyPaymentResult {
  verified: boolean;
  success: boolean;
  transactionRef: string | null;
  providerTransactionId?: string;
}

export interface PaymentGateway {
  createPaymentUrl(request: CreatePaymentRequest): Promise<CreatePaymentResult>;

  verifyCallback(params: Record<string, string>): VerifyPaymentResult;
}
