import { Module } from "@nestjs/common";
import { EventModule } from "../event/event.module";
import { EventReadModel } from "../event/application/event-read-model";
import { SeatStreamService } from "../event/infrastructure/seat-stream.service";
import { PreviewRefundUseCase } from "./application/preview-refund.use-case";
import { RequestRefundUseCase } from "./application/request-refund.use-case";
import {
  REFUND_NOTIFIER,
  REFUND_QUERY_PORT,
  REFUND_UNIT_OF_WORK,
  type RefundNotifier,
  type RefundQueryPort,
  type RefundUnitOfWork,
} from "./domain/refund.ports";
import {
  DrizzleRefundQuery,
  DrizzleRefundUnitOfWork,
} from "./infrastructure/drizzle-refund.repository";
import { EventSideEffectsNotifier } from "./infrastructure/event-side-effects.notifier";
import { RefundsController } from "./interface/refunds.controller";

@Module({
  imports: [EventModule],
  controllers: [RefundsController],
  providers: [
    { provide: REFUND_QUERY_PORT, useClass: DrizzleRefundQuery },
    { provide: REFUND_UNIT_OF_WORK, useClass: DrizzleRefundUnitOfWork },
    {
      provide: REFUND_NOTIFIER,
      useFactory: (cache?: EventReadModel, stream?: SeatStreamService) =>
        new EventSideEffectsNotifier(cache, stream),
      inject: [
        { token: EventReadModel, optional: true },
        { token: SeatStreamService, optional: true },
      ],
    },
    {
      provide: PreviewRefundUseCase,
      useFactory: (query: RefundQueryPort) => new PreviewRefundUseCase(query),
      inject: [REFUND_QUERY_PORT],
    },
    {
      provide: RequestRefundUseCase,
      useFactory: (
        query: RefundQueryPort,
        uow: RefundUnitOfWork,
        notifier: RefundNotifier,
      ) => new RequestRefundUseCase(query, uow, notifier),
      inject: [REFUND_QUERY_PORT, REFUND_UNIT_OF_WORK, REFUND_NOTIFIER],
    },
  ],
  exports: [PreviewRefundUseCase, RequestRefundUseCase],
})
export class RefundModule {}
