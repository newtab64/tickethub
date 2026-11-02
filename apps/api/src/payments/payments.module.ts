import { Module } from "@nestjs/common";

import { VnpayIpnPreviewController } from "./vnpay-ipn.preview.controller";
import { VnpayIpnPreviewService } from "./vnpay-ipn.preview.service";
import { PaymentSettlementService } from "./payment-settlement.service";
import { PaymentController } from "./payment.controller";
import { PaymentService } from "./payment.service";
import { EventsModule } from "../events/events.module";
import { VnpayIpnController } from "./vnpay-ipn.controller";
import { VnpayIpnService } from "./vnpay-ipn.service";
import { VnpayReconciliationService } from "./vnpay-reconciliation.service";
import { RefundRequestService } from "./refund-request.service";
@Module({
  imports: [EventsModule],
  controllers: [
    PaymentController,
    VnpayIpnPreviewController,
    VnpayIpnController,
  ],
  providers: [
    PaymentService,
    VnpayIpnPreviewService,
    VnpayIpnService,
    PaymentSettlementService,
    VnpayReconciliationService,
    RefundRequestService,
  ],
})
export class PaymentsModule {}
