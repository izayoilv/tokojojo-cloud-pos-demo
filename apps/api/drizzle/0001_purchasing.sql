CREATE TABLE "purchase_items" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"purchase_id" uuid NOT NULL,
	"product_id" uuid NOT NULL,
	"product_unit_id" uuid NOT NULL,
	"product_name" text NOT NULL,
	"unit_name" text NOT NULL,
	"qty" numeric(12, 3) NOT NULL,
	"qty_base" numeric(12, 3) NOT NULL,
	"unit_cost" bigint NOT NULL,
	"subtotal" bigint NOT NULL,
	CONSTRAINT "purchase_items_qty_positive" CHECK ("purchase_items"."qty" > 0),
	CONSTRAINT "purchase_items_qty_base_positive" CHECK ("purchase_items"."qty_base" > 0),
	CONSTRAINT "purchase_items_product_name_not_blank" CHECK (btrim("purchase_items"."product_name") <> ''),
	CONSTRAINT "purchase_items_unit_name_not_blank" CHECK (btrim("purchase_items"."unit_name") <> ''),
	CONSTRAINT "purchase_items_unit_cost_non_negative" CHECK ("purchase_items"."unit_cost" >= 0),
	CONSTRAINT "purchase_items_subtotal_matches_qty_cost" CHECK ("purchase_items"."subtotal" = ROUND("purchase_items"."qty" * "purchase_items"."unit_cost")::bigint)
);
--> statement-breakpoint
CREATE TABLE "purchase_payments" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"purchase_id" uuid NOT NULL,
	"amount" bigint NOT NULL,
	"payment_method" "payment_method" NOT NULL,
	"reference" text,
	"paid_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid NOT NULL,
	CONSTRAINT "purchase_payments_amount_positive" CHECK ("purchase_payments"."amount" > 0)
);
--> statement-breakpoint
CREATE TABLE "purchases" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"purchase_no" text NOT NULL,
	"supplier_id" uuid NOT NULL,
	"supplier_name" text NOT NULL,
	"created_by" uuid NOT NULL,
	"supplier_invoice_no" text,
	"due_date" date,
	"total_amount" bigint NOT NULL,
	"received_at" timestamp with time zone DEFAULT now() NOT NULL,
	"status" "purchase_status" DEFAULT 'OPEN' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "purchases_purchase_no_unique" UNIQUE("purchase_no"),
	CONSTRAINT "purchases_supplier_name_not_blank" CHECK (btrim("purchases"."supplier_name") <> ''),
	CONSTRAINT "purchases_purchase_no_not_blank" CHECK (btrim("purchases"."purchase_no") <> ''),
	CONSTRAINT "purchases_total_amount_non_negative" CHECK ("purchases"."total_amount" >= 0)
);
--> statement-breakpoint
ALTER TABLE "purchase_items" ADD CONSTRAINT "purchase_items_purchase_id_purchases_id_fk" FOREIGN KEY ("purchase_id") REFERENCES "public"."purchases"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchase_items" ADD CONSTRAINT "purchase_items_product_unit_fk" FOREIGN KEY ("product_id","product_unit_id") REFERENCES "public"."product_units"("product_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchase_payments" ADD CONSTRAINT "purchase_payments_purchase_id_purchases_id_fk" FOREIGN KEY ("purchase_id") REFERENCES "public"."purchases"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchase_payments" ADD CONSTRAINT "purchase_payments_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchases" ADD CONSTRAINT "purchases_supplier_id_suppliers_id_fk" FOREIGN KEY ("supplier_id") REFERENCES "public"."suppliers"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchases" ADD CONSTRAINT "purchases_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "purchase_items_purchase_id_idx" ON "purchase_items" USING btree ("purchase_id");--> statement-breakpoint
CREATE INDEX "purchase_items_product_id_idx" ON "purchase_items" USING btree ("product_id");--> statement-breakpoint
CREATE INDEX "purchase_payments_purchase_id_paid_at_idx" ON "purchase_payments" USING btree ("purchase_id","paid_at");--> statement-breakpoint
CREATE INDEX "purchase_payments_paid_at_idx" ON "purchase_payments" USING btree ("paid_at");--> statement-breakpoint
CREATE INDEX "purchases_supplier_id_created_at_idx" ON "purchases" USING btree ("supplier_id","created_at");--> statement-breakpoint
CREATE INDEX "purchases_created_at_idx" ON "purchases" USING btree ("created_at");
