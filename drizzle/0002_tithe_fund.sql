ALTER TABLE "goals" ADD COLUMN "is_tithe" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "households" ADD COLUMN "tithe_pct" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "transactions" ADD COLUMN "parent_id" text;--> statement-breakpoint
CREATE INDEX "transactions_parent_idx" ON "transactions" USING btree ("parent_id");