import { PreviewRefundUseCase } from "./application/preview-refund.use-case";
import { RequestRefundUseCase } from "./application/request-refund.use-case";
import type { RefundNotifier } from "./domain/refund.ports";
import {
  DrizzleRefundQuery,
  DrizzleRefundUnitOfWork,
} from "./infrastructure/drizzle-refund.repository";

/** Lap rap use case voi ha tang Drizzle that (dung cho test tich hop va script). */
export function createRefundUseCases(notifier?: RefundNotifier) {
  const query = new DrizzleRefundQuery();
  return {
    preview: new PreviewRefundUseCase(query),
    request: new RequestRefundUseCase(
      query,
      new DrizzleRefundUnitOfWork(),
      notifier,
    ),
  };
}
