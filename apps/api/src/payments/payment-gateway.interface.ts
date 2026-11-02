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
  vnpCreateDate?: string;
}

export interface VerifyPaymentResult {
  verified: boolean;
  success: boolean;
  transactionRef: string | null;
  providerTransactionId?: string;
  amountVnd?: number;
}

export interface PaymentGateway {
  createPaymentUrl(request: CreatePaymentRequest): Promise<CreatePaymentResult>;

  verifyCallback(params: Record<string, string>): VerifyPaymentResult;
}
