ALTER TABLE "transactions" ADD COLUMN "import_batch" text;--> statement-breakpoint
CREATE INDEX "transactions_import_batch_idx" ON "transactions" USING btree ("import_batch");