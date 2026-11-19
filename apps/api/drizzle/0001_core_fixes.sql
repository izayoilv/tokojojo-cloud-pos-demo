ALTER TABLE "stock_movements" DROP CONSTRAINT "stock_movements_created_by_users_id_fk";
--> statement-breakpoint
ALTER TABLE "debt_payments" DROP CONSTRAINT "debt_payments_transaction_id_transactions_id_fk";
--> statement-breakpoint
ALTER TABLE "debt_payments" DROP CONSTRAINT "debt_payments_customer_id_customers_id_fk";
--> statement-breakpoint
ALTER TABLE "transaction_items" DROP CONSTRAINT "transaction_items_transaction_id_transactions_id_fk";
--> statement-breakpoint
ALTER TABLE "transactions" DROP CONSTRAINT "transactions_device_id_devices_id_fk";
--> statement-breakpoint
ALTER TABLE "transactions" DROP CONSTRAINT "transactions_customer_id_customers_id_fk";
--> statement-breakpoint
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "debt_payments" ADD CONSTRAINT "debt_payments_transaction_id_transactions_id_fk" FOREIGN KEY ("transaction_id") REFERENCES "public"."transactions"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "debt_payments" ADD CONSTRAINT "debt_payments_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transaction_items" ADD CONSTRAINT "transaction_items_transaction_id_transactions_id_fk" FOREIGN KEY ("transaction_id") REFERENCES "public"."transactions"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_device_id_devices_id_fk" FOREIGN KEY ("device_id") REFERENCES "public"."devices"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "activity_logs_tenant_created_idx" ON "activity_logs" USING btree ("tenant_id","created_at");--> statement-breakpoint
CREATE INDEX "activity_logs_tenant_entity_idx" ON "activity_logs" USING btree ("tenant_id","entity_type","entity_id");--> statement-breakpoint
CREATE UNIQUE INDEX "product_units_tenant_product_name_uq" ON "product_units" USING btree ("tenant_id","product_id","unit_name");--> statement-breakpoint
CREATE INDEX "products_tenant_category_idx" ON "products" USING btree ("tenant_id","category_id");--> statement-breakpoint
CREATE INDEX "cash_flows_reference_idx" ON "cash_flows" USING btree ("reference_id");--> statement-breakpoint
CREATE INDEX "stock_movements_tenant_created_idx" ON "stock_movements" USING btree ("tenant_id","created_at");--> statement-breakpoint
CREATE INDEX "stock_movements_reference_idx" ON "stock_movements" USING btree ("reference_id");--> statement-breakpoint
CREATE INDEX "suppliers_tenant_idx" ON "suppliers" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "customers_tenant_idx" ON "customers" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "customers_tenant_name_idx" ON "customers" USING btree ("tenant_id","name");--> statement-breakpoint
CREATE INDEX "debt_payments_transaction_idx" ON "debt_payments" USING btree ("transaction_id");--> statement-breakpoint
CREATE INDEX "debt_payments_customer_created_idx" ON "debt_payments" USING btree ("customer_id","created_at");--> statement-breakpoint
CREATE INDEX "transaction_items_transaction_idx" ON "transaction_items" USING btree ("transaction_id");--> statement-breakpoint
CREATE INDEX "transaction_items_product_idx" ON "transaction_items" USING btree ("product_id");--> statement-breakpoint
CREATE INDEX "transaction_items_product_unit_idx" ON "transaction_items" USING btree ("product_unit_id");--> statement-breakpoint
CREATE INDEX "transactions_customer_idx" ON "transactions" USING btree ("customer_id");--> statement-breakpoint
CREATE INDEX "transactions_device_idx" ON "transactions" USING btree ("device_id");--> statement-breakpoint
CREATE INDEX "transactions_user_idx" ON "transactions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "device_events_status_created_idx" ON "device_events" USING btree ("status","created_at");--> statement-breakpoint
CREATE INDEX "device_events_tenant_device_status_idx" ON "device_events" USING btree ("tenant_id","device_id","status");--> statement-breakpoint
CREATE INDEX "sync_batches_status_received_idx" ON "sync_batches" USING btree ("status","received_at");--> statement-breakpoint
ALTER TABLE "product_units" ADD CONSTRAINT "product_units_conversion_qty_positive" CHECK ("product_units"."conversion_qty" > 0);--> statement-breakpoint
ALTER TABLE "product_units" ADD CONSTRAINT "product_units_selling_price_nonnegative" CHECK ("product_units"."selling_price" >= 0);--> statement-breakpoint
ALTER TABLE "products" ADD CONSTRAINT "products_base_cost_price_nonnegative" CHECK ("products"."base_cost_price" >= 0);--> statement-breakpoint
ALTER TABLE "products" ADD CONSTRAINT "products_min_stock_alert_nonnegative" CHECK ("products"."min_stock_alert" >= 0);--> statement-breakpoint
ALTER TABLE "cash_flows" ADD CONSTRAINT "cash_flows_amount_positive" CHECK ("cash_flows"."amount" > 0);--> statement-breakpoint
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_qty_nonzero" CHECK ("stock_movements"."qty" <> 0);--> statement-breakpoint
ALTER TABLE "debt_payments" ADD CONSTRAINT "debt_payments_amount_positive" CHECK ("debt_payments"."amount_paid" > 0);--> statement-breakpoint
ALTER TABLE "debt_payments" ADD CONSTRAINT "debt_payments_method_not_debt" CHECK ("debt_payments"."payment_method" <> 'DEBT');--> statement-breakpoint
ALTER TABLE "transaction_items" ADD CONSTRAINT "transaction_items_qty_positive" CHECK ("transaction_items"."qty" > 0);--> statement-breakpoint
ALTER TABLE "transaction_items" ADD CONSTRAINT "transaction_items_unit_price_nonnegative" CHECK ("transaction_items"."unit_price" >= 0);--> statement-breakpoint
ALTER TABLE "transaction_items" ADD CONSTRAINT "transaction_items_subtotal_nonnegative" CHECK ("transaction_items"."subtotal" >= 0);--> statement-breakpoint
ALTER TABLE "transaction_items" ADD CONSTRAINT "transaction_items_subtotal_matches" CHECK ("transaction_items"."subtotal" = "transaction_items"."qty" * "transaction_items"."unit_price");--> statement-breakpoint
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_amounts_nonnegative" CHECK ("transactions"."subtotal" >= 0 AND "transactions"."discount" >= 0 AND "transactions"."total_amount" >= 0 AND "transactions"."amount_paid" >= 0 AND "transactions"."cash_received" >= 0 AND "transactions"."change_amount" >= 0);--> statement-breakpoint
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_discount_lte_subtotal" CHECK ("transactions"."discount" <= "transactions"."subtotal");--> statement-breakpoint
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_total_matches" CHECK ("transactions"."total_amount" = "transactions"."subtotal" - "transactions"."discount");--> statement-breakpoint
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_debt_requires_customer" CHECK ("transactions"."payment_method" <> 'DEBT' OR "transactions"."customer_id" IS NOT NULL);--> statement-breakpoint
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_client_order_requires_device" CHECK ("transactions"."client_order_id" IS NULL OR "transactions"."device_id" IS NOT NULL);--> statement-breakpoint
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_status_amount_consistent" CHECK (("transactions"."payment_status" = 'PAID' AND "transactions"."amount_paid" >= "transactions"."total_amount") OR ("transactions"."payment_status" = 'PARTIAL' AND "transactions"."amount_paid" > 0 AND "transactions"."amount_paid" < "transactions"."total_amount") OR ("transactions"."payment_status" = 'UNPAID' AND "transactions"."amount_paid" = 0));--> statement-breakpoint
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_cash_consistent" CHECK ("transactions"."payment_method" <> 'CASH' OR ("transactions"."amount_paid" = "transactions"."total_amount" AND "transactions"."cash_received" >= "transactions"."total_amount" AND "transactions"."change_amount" = "transactions"."cash_received" - "transactions"."total_amount"));--> statement-breakpoint
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_qris_consistent" CHECK ("transactions"."payment_method" <> 'QRIS' OR ("transactions"."amount_paid" = "transactions"."total_amount" AND "transactions"."cash_received" = 0 AND "transactions"."change_amount" = 0));--> statement-breakpoint
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_debt_amount_lte_total" CHECK ("transactions"."payment_method" <> 'DEBT' OR ("transactions"."customer_id" IS NOT NULL AND "transactions"."amount_paid" <= "transactions"."total_amount"));--> statement-breakpoint
ALTER TABLE "sync_batches" ADD CONSTRAINT "sync_batches_event_count_nonnegative" CHECK ("sync_batches"."event_count" >= 0);
