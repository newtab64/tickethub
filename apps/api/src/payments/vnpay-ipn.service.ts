import { Inject, Injectable } from "@nestjs/common";

import { VnpayGateway } from "./vnpay.gateway";
import { type IpnDecision } from "./vnpay-ipn.decision";
import { PaymentSettlementService } from "./payment-settlement.service";
import {
  pickRawEvidence,
  resolveOutcome,
  type VerifiedPaymentResult,
} from "./payment-settlement.types";

@Injectable()
export class VnpayIpnService {
  private readonly gateway = new VnpayGateway();

  constructor(
    @Inject(PaymentSettlementService)
    private readonly settlementService: PaymentSettlementService,
  ) {}

  async process(params: Record<string, string>): Promise<IpnDecision> {
    // 1. Xác minh chữ ký và merchant VNPay
    const verified = this.gateway.verifyCallback(params);

    if (!verified.verified || !verified.transactionRef) {
      return "INVALID_SIGNATURE";
    }

    // 2. Kết quả cuối cùng (quy tắc dùng chung với QueryDR)
    const outcome = resolveOutcome(
      params.vnp_ResponseCode ?? "",
      params.vnp_TransactionStatus ?? "",
    );

    if (outcome === null) {
      return "MANUAL_REVIEW";
    }

    // 3. Chuyển sang định dạng chung rồi giao cho settlement
    const evidence: VerifiedPaymentResult = {
      source: "IPN",
      transactionRef: verified.transactionRef,
      amountMinor: params.vnp_Amount ?? "",
      outcome,
      responseCode: params.vnp_ResponseCode ?? "",
      transactionStatus: params.vnp_TransactionStatus ?? "",
      providerTransactionId: verified.providerTransactionId ?? null,
      bankCode: params.vnp_BankCode ?? null,
      rawEvidence: pickRawEvidence(params),
    };

    return this.settlementService.settle(evidence);
  }
}
