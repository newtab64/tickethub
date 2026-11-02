ALTER TABLE "refunds" ADD COLUMN "provider_request_id" varchar(32);--> statement-breakpoint
ALTER TABLE "refunds" ADD COLUMN "needs_reconciliation" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "refunds" ADD COLUMN "last_attempt_at" timestamp with time zone;--> statement-breakpoint
CREATE UNIQUE INDEX "uq_refunds_active_ticket" ON "refunds" USING btree ("ticket_id") WHERE 
        "refunds"."ticket_id" IS NOT NULL
        AND "refunds"."status" IN ('PENDING', 'PROCESSING', 'COMPLETED')
      ;--> statement-breakpoint
CREATE UNIQUE INDEX "uq_refunds_active_full_order" ON "refunds" USING btree ("order_id") WHERE 
        "refunds"."ticket_id" IS NULL
        AND "refunds"."status" IN ('PENDING', 'PROCESSING', 'COMPLETED')
      ;--> statement-breakpoint
ALTER TABLE "refunds" ADD CONSTRAINT "refunds_provider_request_id_unique" UNIQUE("provider_request_id");--> statement-breakpoint
ALTER TABLE "refunds" ADD CONSTRAINT "chk_refunds_amount_positive" CHECK ("refunds"."amount" > 0);--> statement-breakpoint
ALTER TABLE "refunds" ADD CONSTRAINT "chk_refunds_retry_nonnegative" CHECK ("refunds"."retry_count" >= 0);