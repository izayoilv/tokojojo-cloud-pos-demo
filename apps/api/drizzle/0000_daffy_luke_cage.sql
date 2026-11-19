CREATE TYPE "public"."user_role" AS ENUM('owner', 'kasir');--> statement-breakpoint
CREATE TYPE "public"."cash_category" AS ENUM('SALES', 'DEBT_PAYMENT', 'CAPITAL_IN', 'RESTOCK', 'SALARY', 'OPERATIONAL', 'QRIS_WITHDRAWAL');--> statement-breakpoint
CREATE TYPE "public"."cash_flow_type" AS ENUM('IN', 'OUT');--> statement-breakpoint
CREATE TYPE "public"."wallet_source" AS ENUM('CASH_DRAWER', 'QRIS_BALANCE');--> statement-breakpoint
CREATE TYPE "public"."stock_movement_type" AS ENUM('SALE', 'RESTOCK', 'ADJUSTMENT', 'OPNAME', 'RETURN');--> statement-breakpoint
CREATE TYPE "public"."payment_method" AS ENUM('CASH', 'QRIS', 'DEBT');--> statement-breakpoint
CREATE TYPE "public"."payment_status" AS ENUM('PAID', 'PARTIAL', 'UNPAID');--> statement-breakpoint
CREATE TYPE "public"."sync_batch_status" AS ENUM('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED');--> statement-breakpoint
CREATE TYPE "public"."sync_event_status" AS ENUM('PENDING', 'APPLIED', 'SKIPPED', 'FAILED');--> statement-breakpoint
CREATE TYPE "public"."sync_event_type" AS ENUM('ORDER_CREATE', 'STOCK_UPDATE', 'DEBT_PAYMENT');--> statement-breakpoint
CREATE TABLE "activity_logs" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"action" text NOT NULL,
	"entity_type" text NOT NULL,
	"entity_id" uuid NOT NULL,
	"old_data" jsonb,
	"new_data" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "devices" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"client_fingerprint" uuid NOT NULL,
	"platform" text NOT NULL,
	"name" text NOT NULL,
	"revoked_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"email" text NOT NULL,
	"name" text NOT NULL,
	"password_hash" text NOT NULL,
	"role" "user_role" DEFAULT 'kasir' NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "categories" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"name" text NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "product_units" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"product_id" uuid NOT NULL,
	"unit_name" text NOT NULL,
	"conversion_qty" numeric(12, 2) NOT NULL,
	"selling_price" numeric(14, 2) NOT NULL,
	"barcode" text
);
--> statement-breakpoint
CREATE TABLE "products" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"category_id" uuid,
	"name" text NOT NULL,
	"base_unit" text NOT NULL,
	"current_stock" numeric(12, 2) DEFAULT '0' NOT NULL,
	"base_cost_price" numeric(14, 2) NOT NULL,
	"min_stock_alert" numeric(12, 2) DEFAULT '5' NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "cash_flows" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"type" "cash_flow_type" NOT NULL,
	"wallet_source" "wallet_source" NOT NULL,
	"category" "cash_category" NOT NULL,
	"amount" numeric(14, 2) NOT NULL,
	"reference_id" uuid,
	"description" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "stock_movements" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"product_id" uuid NOT NULL,
	"type" "stock_movement_type" NOT NULL,
	"qty" numeric(12, 2) NOT NULL,
	"reference_id" uuid,
	"expiration_date" timestamp with time zone,
	"notes" text,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "suppliers" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"name" text NOT NULL,
	"phone" text
);
--> statement-breakpoint
CREATE TABLE "customers" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"name" text NOT NULL,
	"phone" text,
	"address_note" text,
	"total_debt" numeric(14, 2) DEFAULT '0' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "debt_payments" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"transaction_id" uuid NOT NULL,
	"customer_id" uuid NOT NULL,
	"amount_paid" numeric(14, 2) NOT NULL,
	"payment_method" "payment_method" NOT NULL,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "transaction_items" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"transaction_id" uuid NOT NULL,
	"product_id" uuid NOT NULL,
	"product_unit_id" uuid NOT NULL,
	"qty" numeric(12, 2) NOT NULL,
	"unit_price" numeric(14, 2) NOT NULL,
	"subtotal" numeric(14, 2) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "transactions" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"device_id" uuid,
	"client_order_id" uuid,
	"invoice_no" text NOT NULL,
	"customer_id" uuid,
	"subtotal" numeric(14, 2) NOT NULL,
	"discount" numeric(14, 2) DEFAULT '0' NOT NULL,
	"total_amount" numeric(14, 2) NOT NULL,
	"payment_method" "payment_method" NOT NULL,
	"payment_status" "payment_status" NOT NULL,
	"amount_paid" numeric(14, 2) NOT NULL,
	"cash_received" numeric(14, 2) DEFAULT '0' NOT NULL,
	"change_amount" numeric(14, 2) DEFAULT '0' NOT NULL,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "device_events" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"device_id" uuid NOT NULL,
	"batch_id" uuid,
	"client_event_id" uuid NOT NULL,
	"event_type" "sync_event_type" NOT NULL,
	"entity_type" text NOT NULL,
	"entity_id" uuid,
	"payload" jsonb NOT NULL,
	"status" "sync_event_status" DEFAULT 'PENDING' NOT NULL,
	"error" text,
	"processed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sync_batches" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"device_id" uuid NOT NULL,
	"client_batch_id" uuid NOT NULL,
	"status" "sync_batch_status" DEFAULT 'PENDING' NOT NULL,
	"event_count" bigint DEFAULT 0 NOT NULL,
	"received_at" timestamp with time zone DEFAULT now() NOT NULL,
	"completed_at" timestamp with time zone,
	"error" text
);
--> statement-breakpoint
CREATE TABLE "tenants" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "tenants_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
ALTER TABLE "activity_logs" ADD CONSTRAINT "activity_logs_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "devices" ADD CONSTRAINT "devices_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "categories" ADD CONSTRAINT "categories_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_units" ADD CONSTRAINT "product_units_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_units" ADD CONSTRAINT "product_units_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "products" ADD CONSTRAINT "products_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "products" ADD CONSTRAINT "products_category_id_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cash_flows" ADD CONSTRAINT "cash_flows_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "suppliers" ADD CONSTRAINT "suppliers_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customers" ADD CONSTRAINT "customers_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "debt_payments" ADD CONSTRAINT "debt_payments_transaction_id_transactions_id_fk" FOREIGN KEY ("transaction_id") REFERENCES "public"."transactions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "debt_payments" ADD CONSTRAINT "debt_payments_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transaction_items" ADD CONSTRAINT "transaction_items_transaction_id_transactions_id_fk" FOREIGN KEY ("transaction_id") REFERENCES "public"."transactions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transaction_items" ADD CONSTRAINT "transaction_items_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transaction_items" ADD CONSTRAINT "transaction_items_product_unit_id_product_units_id_fk" FOREIGN KEY ("product_unit_id") REFERENCES "public"."product_units"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_device_id_devices_id_fk" FOREIGN KEY ("device_id") REFERENCES "public"."devices"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "device_events" ADD CONSTRAINT "device_events_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "device_events" ADD CONSTRAINT "device_events_device_id_devices_id_fk" FOREIGN KEY ("device_id") REFERENCES "public"."devices"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "device_events" ADD CONSTRAINT "device_events_batch_id_sync_batches_id_fk" FOREIGN KEY ("batch_id") REFERENCES "public"."sync_batches"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sync_batches" ADD CONSTRAINT "sync_batches_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sync_batches" ADD CONSTRAINT "sync_batches_device_id_devices_id_fk" FOREIGN KEY ("device_id") REFERENCES "public"."devices"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "activity_logs_tenant_idx" ON "activity_logs" USING btree ("tenant_id");--> statement-breakpoint
CREATE UNIQUE INDEX "devices_tenant_fingerprint_uq" ON "devices" USING btree ("tenant_id","client_fingerprint");--> statement-breakpoint
CREATE UNIQUE INDEX "users_tenant_email_uq" ON "users" USING btree ("tenant_id","email");--> statement-breakpoint
CREATE UNIQUE INDEX "categories_tenant_name_uq" ON "categories" USING btree ("tenant_id","name");--> statement-breakpoint
CREATE UNIQUE INDEX "product_units_barcode_uq" ON "product_units" USING btree ("tenant_id","barcode") WHERE "product_units"."barcode" IS NOT NULL;--> statement-breakpoint
CREATE INDEX "product_units_product_idx" ON "product_units" USING btree ("product_id");--> statement-breakpoint
CREATE INDEX "products_tenant_idx" ON "products" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "cash_flows_tenant_date_idx" ON "cash_flows" USING btree ("tenant_id","created_at");--> statement-breakpoint
CREATE INDEX "stock_movements_tenant_product_idx" ON "stock_movements" USING btree ("tenant_id","product_id");--> statement-breakpoint
CREATE UNIQUE INDEX "transactions_tenant_invoice_uq" ON "transactions" USING btree ("tenant_id","invoice_no");--> statement-breakpoint
CREATE UNIQUE INDEX "transactions_tenant_device_client_uq" ON "transactions" USING btree ("tenant_id","device_id","client_order_id") WHERE "transactions"."client_order_id" IS NOT NULL;--> statement-breakpoint
CREATE INDEX "transactions_tenant_date_idx" ON "transactions" USING btree ("tenant_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "device_events_tenant_device_event_uq" ON "device_events" USING btree ("tenant_id","device_id","client_event_id");--> statement-breakpoint
CREATE INDEX "device_events_batch_idx" ON "device_events" USING btree ("batch_id");--> statement-breakpoint
CREATE UNIQUE INDEX "sync_batches_tenant_device_batch_uq" ON "sync_batches" USING btree ("tenant_id","device_id","client_batch_id");--> statement-breakpoint
CREATE INDEX "sync_batches_tenant_idx" ON "sync_batches" USING btree ("tenant_id");
