import { PaymentProvider } from "@tickethub/shared";
import type { IpnVerdict } from "../domain/ipn-decision";
import { decideVnpayIpn } from "../domain/ipn-decision";
import { amountsMatch } from "../domain/ipn-rules";
import type { VnpayParams } from "../domain/payment.models";
import type { PaymentGateway } from "../domain/payment-gateway";
import type { PaymentQueryPort } from "../domain/payment.ports";

/** Xem truoc quyet dinh IPN o che do chi doc, khong cap nhat database. */
export class PreviewVnpayIpnUseCase {
  constructor(
    private readonly gateway: PaymentGateway,
    private readonly query: PaymentQueryPort,
  ) {}

  async inspect(params: VnpayParams): Promise<IpnVerdict> {
    const verified = this.gateway.verifyCallback(params);
    if (!verified.verified || !verified.transactionRef) {
      return "INVALID_SIGNATURE";
    }

    const transaction = await this.query.findTransactionByRef(
      verified.transactionRef,
    );
    if (!transaction) return "ORDER_NOT_FOUND";
    if (transaction.provider !== PaymentProvider.VNPAY) return "MANUAL_REVIEW";

    const order = await this.query.findOrder(transaction.orderId);
    if (!order) return "MANUAL_REVIEW";

    return decideVnpayIpn({
      signatureValid: true,
      transactionFound: true,
      amountMatches: amountsMatch(
        params.vnp_Amount,
        transaction.amount,
        order.finalAmount,
      ),
      orderStatus: order.status,
      transactionStatus: transaction.status,
      paymentSuccessful: verified.success,
      orderExpired: new Date() >= order.expiresAt,
    });
  }
}
