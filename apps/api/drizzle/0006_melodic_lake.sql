CREATE TABLE "payment_reconciliations" (
	"transaction_id" uuid PRIMARY KEY NOT NULL,
	"status" varchar(20) DEFAULT 'PENDING' NOT NULL,
	"attempt_count" integer DEFAULT 0 NOT NULL,
	"next_run_at" timestamp with time zone NOT NULL,
	"lease_until" timestamp with time zone,
	"lease_token" uuid,
	"last_decision" varchar(64),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "payment_reconciliations" ADD CONSTRAINT "payment_reconciliations_transaction_id_transactions_id_fk" FOREIGN KEY ("transaction_id") REFERENCES "public"."transactions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_payment_reconciliation_schedule" ON "payment_reconciliations" USING btree ("status","next_run_at");