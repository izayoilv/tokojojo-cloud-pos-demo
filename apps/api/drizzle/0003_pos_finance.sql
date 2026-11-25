CREATE TABLE "cashier_shifts" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"user_id" uuid NOT NULL,
	"status" "shift_status" DEFAULT 'OPEN' NOT NULL,
	"opened_at" timestamp with time zone DEFAULT now() NOT NULL,
	"closed_at" timestamp with time zone,
	"opening_cash" bigint DEFAULT 0 NOT NULL,
	"expected_cash" bigint,
	"actual_cash" bigint,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "cashier_shifts_opening_cash_non_negative" CHECK ("cashier_shifts"."opening_cash" >= 0),
	CONSTRAINT "cashier_shifts_actual_cash_non_negative" CHECK ("cashier_shifts"."actual_cash" >= 0),
	CONSTRAINT "cashier_shifts_close_fields_consistent" CHECK (("cashier_shifts"."status" = 'OPEN'
          AND "cashier_shifts"."closed_at" IS NULL
          AND "cashier_shifts"."expected_cash" IS NULL
          AND "cashier_shifts"."actual_cash" IS NULL)
        OR ("cashier_shifts"."status" = 'CLOSED'
          AND "cashier_shifts"."closed_at" IS NOT NULL
          AND "cashier_shifts"."expected_cash" IS NOT NULL
          AND "cashier_shifts"."actual_cash" IS NOT NULL))
);
--> statement-breakpoint
CREATE TABLE "sale_items" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"sale_id" uuid NOT NULL,
	"product_id" uuid NOT NULL,
	"product_unit_id" uuid NOT NULL,
	"product_name" text NOT NULL,
	"unit_name" text NOT NULL,
	"qty" numeric(12, 3) NOT NULL,
	"qty_base" numeric(12, 3) NOT NULL,
	"unit_price" bigint NOT NULL,
	"discount" bigint DEFAULT 0 NOT NULL,
	"unit_cost" bigint NOT NULL,
	"subtotal" bigint NOT NULL,
	CONSTRAINT "sale_items_qty_positive" CHECK ("sale_items"."qty" > 0),
	CONSTRAINT "sale_items_qty_base_positive" CHECK ("sale_items"."qty_base" > 0),
	CONSTRAINT "sale_items_product_name_not_blank" CHECK (btrim("sale_items"."product_name") <> ''),
	CONSTRAINT "sale_items_unit_name_not_blank" CHECK (btrim("sale_items"."unit_name") <> ''),
	CONSTRAINT "sale_items_unit_price_non_negative" CHECK ("sale_items"."unit_price" >= 0),
	CONSTRAINT "sale_items_discount_non_negative" CHECK ("sale_items"."discount" >= 0),
	CONSTRAINT "sale_items_discount_within_unit_price" CHECK ("sale_items"."discount" <= "sale_items"."unit_price"),
	CONSTRAINT "sale_items_unit_cost_non_negative" CHECK ("sale_items"."unit_cost" >= 0),
	CONSTRAINT "sale_items_subtotal_matches_qty_price" CHECK ("sale_items"."subtotal" = ROUND("sale_items"."qty" * "sale_items"."unit_price")::bigint)
);
--> statement-breakpoint
CREATE TABLE "sale_payments" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"sale_id" uuid NOT NULL,
	"method" "payment_method" NOT NULL,
	"amount" bigint NOT NULL,
	"cash_received" bigint DEFAULT 0 NOT NULL,
	"change" bigint DEFAULT 0 NOT NULL,
	"shift_id" uuid,
	"received_by" uuid NOT NULL,
	"payment_ref" text,
	"paid_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "sale_payments_amount_positive" CHECK ("sale_payments"."amount" > 0),
	CONSTRAINT "sale_payments_cash_tender_consistent" CHECK (("sale_payments"."method" = 'CASH'
          AND "sale_payments"."cash_received" >= "sale_payments"."amount"
          AND "sale_payments"."change" = "sale_payments"."cash_received" - "sale_payments"."amount")
        OR ("sale_payments"."method" <> 'CASH'
          AND "sale_payments"."cash_received" = 0
          AND "sale_payments"."change" = 0)),
	CONSTRAINT "sale_payments_non_cash_shift_null" CHECK ("sale_payments"."method" = 'CASH' OR "sale_payments"."shift_id" IS NULL)
);
--> statement-breakpoint
CREATE TABLE "sale_return_items" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"return_id" uuid NOT NULL,
	"sale_item_id" uuid NOT NULL,
	"qty" numeric(12, 3) NOT NULL,
	"qty_base" numeric(12, 3) NOT NULL,
	"refund_amount" bigint NOT NULL,
	CONSTRAINT "sale_return_items_qty_positive" CHECK ("sale_return_items"."qty" > 0),
	CONSTRAINT "sale_return_items_qty_base_positive" CHECK ("sale_return_items"."qty_base" > 0),
	CONSTRAINT "sale_return_items_refund_amount_non_negative" CHECK ("sale_return_items"."refund_amount" >= 0)
);
--> statement-breakpoint
CREATE TABLE "sale_returns" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"return_no" text NOT NULL,
	"sale_id" uuid NOT NULL,
	"created_by" uuid NOT NULL,
	"reason" text NOT NULL,
	"total_refund" bigint NOT NULL,
	"cash_refund" bigint DEFAULT 0 NOT NULL,
	"refund_method" "payment_method",
	"refunded_at" timestamp with time zone,
	"shift_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "sale_returns_return_no_unique" UNIQUE("return_no"),
	CONSTRAINT "sale_returns_return_no_not_blank" CHECK (btrim("sale_returns"."return_no") <> ''),
	CONSTRAINT "sale_returns_reason_not_blank" CHECK (btrim("sale_returns"."reason") <> ''),
	CONSTRAINT "sale_returns_total_refund_positive" CHECK ("sale_returns"."total_refund" > 0),
	CONSTRAINT "sale_returns_cash_refund_non_negative" CHECK ("sale_returns"."cash_refund" >= 0),
	CONSTRAINT "sale_returns_cash_refund_within_total" CHECK ("sale_returns"."cash_refund" <= "sale_returns"."total_refund"),
	CONSTRAINT "sale_returns_refund_fields_consistent" CHECK (("sale_returns"."cash_refund" = 0
          AND "sale_returns"."refund_method" IS NULL
          AND "sale_returns"."refunded_at" IS NULL
          AND "sale_returns"."shift_id" IS NULL)
        OR ("sale_returns"."cash_refund" > 0
          AND "sale_returns"."refund_method" IS NOT NULL
          AND "sale_returns"."refunded_at" IS NOT NULL)),
	CONSTRAINT "sale_returns_cash_refund_requires_shift" CHECK ("sale_returns"."refund_method" IS DISTINCT FROM 'CASH'
        OR "sale_returns"."shift_id" IS NOT NULL)
);
--> statement-breakpoint
CREATE TABLE "sales" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"invoice_no" text NOT NULL,
	"shift_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"customer_id" uuid,
	"subtotal" bigint NOT NULL,
	"discount" bigint DEFAULT 0 NOT NULL,
	"total_amount" bigint NOT NULL,
	"settlement_method" "sale_settlement" NOT NULL,
	"status" "sale_status" DEFAULT 'COMPLETED' NOT NULL,
	"voided_at" timestamp with time zone,
	"voided_by" uuid,
	"void_reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "sales_invoice_no_unique" UNIQUE("invoice_no"),
	CONSTRAINT "sales_invoice_no_not_blank" CHECK (btrim("sales"."invoice_no") <> ''),
	CONSTRAINT "sales_subtotal_non_negative" CHECK ("sales"."subtotal" >= 0),
	CONSTRAINT "sales_discount_non_negative" CHECK ("sales"."discount" >= 0),
	CONSTRAINT "sales_discount_within_subtotal" CHECK ("sales"."discount" <= "sales"."subtotal"),
	CONSTRAINT "sales_total_matches_subtotal_discount" CHECK ("sales"."total_amount" = "sales"."subtotal" - "sales"."discount"),
	CONSTRAINT "sales_debt_requires_customer" CHECK ("sales"."settlement_method" <> 'DEBT' OR "sales"."customer_id" IS NOT NULL),
	CONSTRAINT "sales_void_fields_consistent" CHECK (("sales"."status" = 'COMPLETED'
          AND "sales"."voided_at" IS NULL
          AND "sales"."voided_by" IS NULL
          AND "sales"."void_reason" IS NULL)
        OR ("sales"."status" = 'VOIDED'
          AND "sales"."voided_at" IS NOT NULL
          AND "sales"."voided_by" IS NOT NULL
          AND "sales"."void_reason" IS NOT NULL))
);
--> statement-breakpoint
CREATE TABLE "cash_flows" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"type" "cash_flow_type" NOT NULL,
	"payment_method" "payment_method" NOT NULL,
	"category" "cash_flow_category" NOT NULL,
	"amount" bigint NOT NULL,
	"shift_id" uuid,
	"reference_type" "cash_flow_reference_type" NOT NULL,
	"reference_id" uuid,
	"source" "cash_flow_source" NOT NULL,
	"notes" text,
	"created_by" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "cash_flows_amount_positive" CHECK ("cash_flows"."amount" > 0),
	CONSTRAINT "cash_flows_reference_consistency" CHECK (("cash_flows"."source" = 'MANUAL'
          AND "cash_flows"."reference_type" = 'MANUAL'
          AND "cash_flows"."reference_id" IS NULL)
        OR ("cash_flows"."source" = 'AUTO'
          AND "cash_flows"."reference_type" <> 'MANUAL'
          AND "cash_flows"."reference_id" IS NOT NULL)),
	CONSTRAINT "cash_flows_non_cash_shift_null" CHECK ("cash_flows"."payment_method" = 'CASH' OR "cash_flows"."shift_id" IS NULL)
);
--> statement-breakpoint
ALTER TABLE "cashier_shifts" ADD CONSTRAINT "cashier_shifts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sale_items" ADD CONSTRAINT "sale_items_sale_id_sales_id_fk" FOREIGN KEY ("sale_id") REFERENCES "public"."sales"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sale_items" ADD CONSTRAINT "sale_items_product_unit_fk" FOREIGN KEY ("product_id","product_unit_id") REFERENCES "public"."product_units"("product_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sale_payments" ADD CONSTRAINT "sale_payments_sale_id_sales_id_fk" FOREIGN KEY ("sale_id") REFERENCES "public"."sales"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sale_payments" ADD CONSTRAINT "sale_payments_shift_id_cashier_shifts_id_fk" FOREIGN KEY ("shift_id") REFERENCES "public"."cashier_shifts"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sale_payments" ADD CONSTRAINT "sale_payments_received_by_users_id_fk" FOREIGN KEY ("received_by") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sale_return_items" ADD CONSTRAINT "sale_return_items_return_id_sale_returns_id_fk" FOREIGN KEY ("return_id") REFERENCES "public"."sale_returns"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sale_return_items" ADD CONSTRAINT "sale_return_items_sale_item_id_sale_items_id_fk" FOREIGN KEY ("sale_item_id") REFERENCES "public"."sale_items"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sale_returns" ADD CONSTRAINT "sale_returns_sale_id_sales_id_fk" FOREIGN KEY ("sale_id") REFERENCES "public"."sales"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sale_returns" ADD CONSTRAINT "sale_returns_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sale_returns" ADD CONSTRAINT "sale_returns_shift_id_cashier_shifts_id_fk" FOREIGN KEY ("shift_id") REFERENCES "public"."cashier_shifts"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sales" ADD CONSTRAINT "sales_shift_id_cashier_shifts_id_fk" FOREIGN KEY ("shift_id") REFERENCES "public"."cashier_shifts"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sales" ADD CONSTRAINT "sales_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sales" ADD CONSTRAINT "sales_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sales" ADD CONSTRAINT "sales_voided_by_users_id_fk" FOREIGN KEY ("voided_by") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cash_flows" ADD CONSTRAINT "cash_flows_shift_id_cashier_shifts_id_fk" FOREIGN KEY ("shift_id") REFERENCES "public"."cashier_shifts"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cash_flows" ADD CONSTRAINT "cash_flows_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "cashier_shifts_user_id_status_idx" ON "cashier_shifts" USING btree ("user_id","status");--> statement-breakpoint
CREATE UNIQUE INDEX "cashier_shifts_open_per_user_unique" ON "cashier_shifts" USING btree ("user_id") WHERE "cashier_shifts"."status" = 'OPEN';--> statement-breakpoint
CREATE INDEX "sale_items_sale_id_idx" ON "sale_items" USING btree ("sale_id");--> statement-breakpoint
CREATE INDEX "sale_items_product_id_idx" ON "sale_items" USING btree ("product_id");--> statement-breakpoint
CREATE INDEX "sale_payments_sale_id_paid_at_idx" ON "sale_payments" USING btree ("sale_id","paid_at");--> statement-breakpoint
CREATE INDEX "sale_payments_shift_id_idx" ON "sale_payments" USING btree ("shift_id");--> statement-breakpoint
CREATE INDEX "sale_payments_paid_at_idx" ON "sale_payments" USING btree ("paid_at");--> statement-breakpoint
CREATE INDEX "sale_return_items_return_id_idx" ON "sale_return_items" USING btree ("return_id");--> statement-breakpoint
CREATE INDEX "sale_return_items_sale_item_id_idx" ON "sale_return_items" USING btree ("sale_item_id");--> statement-breakpoint
CREATE INDEX "sale_returns_sale_id_created_at_idx" ON "sale_returns" USING btree ("sale_id","created_at");--> statement-breakpoint
CREATE INDEX "sale_returns_shift_id_idx" ON "sale_returns" USING btree ("shift_id");--> statement-breakpoint
CREATE INDEX "sales_created_at_idx" ON "sales" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "sales_shift_id_idx" ON "sales" USING btree ("shift_id");--> statement-breakpoint
CREATE INDEX "sales_customer_id_idx" ON "sales" USING btree ("customer_id");--> statement-breakpoint
CREATE INDEX "sales_settlement_method_idx" ON "sales" USING btree ("settlement_method");--> statement-breakpoint
CREATE INDEX "sales_status_idx" ON "sales" USING btree ("status");--> statement-breakpoint
CREATE INDEX "cash_flows_source_created_at_idx" ON "cash_flows" USING btree ("source","created_at");--> statement-breakpoint
CREATE INDEX "cash_flows_created_at_category_idx" ON "cash_flows" USING btree ("created_at","category");--> statement-breakpoint
CREATE INDEX "cash_flows_shift_id_idx" ON "cash_flows" USING btree ("shift_id");--> statement-breakpoint
CREATE INDEX "cash_flows_reference_type_reference_id_idx" ON "cash_flows" USING btree ("reference_type","reference_id");--> statement-breakpoint
CREATE UNIQUE INDEX "cash_flows_auto_reference_unique" ON "cash_flows" USING btree ("reference_type","reference_id","category","type") WHERE "cash_flows"."source" = 'AUTO';
