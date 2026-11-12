ALTER TABLE "orders" ALTER COLUMN "status" SET DATA TYPE varchar(40);--> statement-breakpoint
ALTER TABLE "orders" ALTER COLUMN "status" SET DEFAULT 'PENDING';