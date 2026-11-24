CREATE TABLE "stock_movements" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"product_id" uuid NOT NULL,
	"location" "stock_location" NOT NULL,
	"qty_change" numeric(12, 3) NOT NULL,
	"movement_type" "stock_movement_type" NOT NULL,
	"reference_type" "reference_type" NOT NULL,
	"reference_id" uuid,
	"notes" text,
	"flagged" boolean DEFAULT false NOT NULL,
	"flag_reason" text,
	"created_by" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "stock_movements_qty_change_non_zero" CHECK ("stock_movements"."qty_change" <> 0),
	CONSTRAINT "stock_movements_reference_consistency" CHECK (("stock_movements"."reference_type" = 'MANUAL' AND "stock_movements"."reference_id" IS NULL)
        OR ("stock_movements"."reference_type" <> 'MANUAL' AND "stock_movements"."reference_id" IS NOT NULL)),
	CONSTRAINT "stock_movements_flag_consistency" CHECK ("stock_movements"."flagged" = ("stock_movements"."flag_reason" IS NOT NULL))
);
--> statement-breakpoint
CREATE TABLE "stock_opname_items" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"opname_id" uuid NOT NULL,
	"product_id" uuid NOT NULL,
	"system_qty" numeric(12, 3) NOT NULL,
	"physical_qty" numeric(12, 3) NOT NULL,
	"diff_qty" numeric(12, 3) NOT NULL,
	CONSTRAINT "stock_opname_items_physical_qty_non_negative" CHECK ("stock_opname_items"."physical_qty" >= 0),
	CONSTRAINT "stock_opname_items_diff_matches_quantities" CHECK ("stock_opname_items"."diff_qty" = "stock_opname_items"."physical_qty" - "stock_opname_items"."system_qty")
);
--> statement-breakpoint
CREATE TABLE "stock_opnames" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"opname_no" text NOT NULL,
	"location" "stock_location" NOT NULL,
	"status" "opname_status" DEFAULT 'PENDING' NOT NULL,
	"created_by" uuid NOT NULL,
	"reviewed_by" uuid,
	"reviewed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "stock_opnames_opname_no_unique" UNIQUE("opname_no"),
	CONSTRAINT "stock_opnames_opname_no_not_blank" CHECK (btrim("stock_opnames"."opname_no") <> ''),
	CONSTRAINT "stock_opnames_review_fields_consistent" CHECK (("stock_opnames"."status" = 'PENDING'
          AND "stock_opnames"."reviewed_by" IS NULL
          AND "stock_opnames"."reviewed_at" IS NULL)
        OR ("stock_opnames"."status" IN ('APPROVED', 'REJECTED')
          AND "stock_opnames"."reviewed_by" IS NOT NULL
          AND "stock_opnames"."reviewed_at" IS NOT NULL))
);
--> statement-breakpoint
CREATE TABLE "stock_transfer_items" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"transfer_id" uuid NOT NULL,
	"product_id" uuid NOT NULL,
	"product_unit_id" uuid NOT NULL,
	"qty" numeric(12, 3) NOT NULL,
	"qty_base" numeric(12, 3) NOT NULL,
	CONSTRAINT "stock_transfer_items_qty_positive" CHECK ("stock_transfer_items"."qty" > 0),
	CONSTRAINT "stock_transfer_items_qty_base_positive" CHECK ("stock_transfer_items"."qty_base" > 0)
);
--> statement-breakpoint
CREATE TABLE "stock_transfers" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"transfer_no" text NOT NULL,
	"from_location" "stock_location" NOT NULL,
	"to_location" "stock_location" NOT NULL,
	"status" "stock_transfer_status" DEFAULT 'PENDING' NOT NULL,
	"created_by" uuid NOT NULL,
	"reviewed_by" uuid,
	"reviewed_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"cancelled_by" uuid,
	"cancelled_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "stock_transfers_transfer_no_unique" UNIQUE("transfer_no"),
	CONSTRAINT "stock_transfers_transfer_no_not_blank" CHECK (btrim("stock_transfers"."transfer_no") <> ''),
	CONSTRAINT "stock_transfers_distinct_locations" CHECK ("stock_transfers"."from_location" <> "stock_transfers"."to_location"),
	CONSTRAINT "stock_transfers_review_fields_consistent" CHECK (("stock_transfers"."status" = 'PENDING'
          AND "stock_transfers"."reviewed_by" IS NULL
          AND "stock_transfers"."reviewed_at" IS NULL
          AND "stock_transfers"."completed_at" IS NULL
          AND "stock_transfers"."cancelled_by" IS NULL
          AND "stock_transfers"."cancelled_at" IS NULL)
        OR ("stock_transfers"."status" = 'COMPLETED'
          AND "stock_transfers"."reviewed_by" IS NOT NULL
          AND "stock_transfers"."reviewed_at" IS NOT NULL
          AND "stock_transfers"."completed_at" IS NOT NULL
          AND "stock_transfers"."cancelled_by" IS NULL
          AND "stock_transfers"."cancelled_at" IS NULL)
        OR ("stock_transfers"."status" = 'CANCELLED'
          AND "stock_transfers"."reviewed_by" IS NULL
          AND "stock_transfers"."reviewed_at" IS NULL
          AND "stock_transfers"."completed_at" IS NULL
          AND "stock_transfers"."cancelled_by" IS NOT NULL
          AND "stock_transfers"."cancelled_at" IS NOT NULL))
);
--> statement-breakpoint
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_opname_items" ADD CONSTRAINT "stock_opname_items_opname_id_stock_opnames_id_fk" FOREIGN KEY ("opname_id") REFERENCES "public"."stock_opnames"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_opname_items" ADD CONSTRAINT "stock_opname_items_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_opnames" ADD CONSTRAINT "stock_opnames_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_opnames" ADD CONSTRAINT "stock_opnames_reviewed_by_users_id_fk" FOREIGN KEY ("reviewed_by") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_transfer_items" ADD CONSTRAINT "stock_transfer_items_transfer_id_stock_transfers_id_fk" FOREIGN KEY ("transfer_id") REFERENCES "public"."stock_transfers"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_transfer_items" ADD CONSTRAINT "stock_transfer_items_product_unit_fk" FOREIGN KEY ("product_id","product_unit_id") REFERENCES "public"."product_units"("product_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_transfers" ADD CONSTRAINT "stock_transfers_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_transfers" ADD CONSTRAINT "stock_transfers_reviewed_by_users_id_fk" FOREIGN KEY ("reviewed_by") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_transfers" ADD CONSTRAINT "stock_transfers_cancelled_by_users_id_fk" FOREIGN KEY ("cancelled_by") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "stock_movements_product_id_location_created_at_idx" ON "stock_movements" USING btree ("product_id","location","created_at");--> statement-breakpoint
CREATE INDEX "stock_movements_reference_type_reference_id_idx" ON "stock_movements" USING btree ("reference_type","reference_id");--> statement-breakpoint
CREATE INDEX "stock_movements_created_at_idx" ON "stock_movements" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "stock_movements_flagged_idx" ON "stock_movements" USING btree ("flagged") WHERE "stock_movements"."flagged";--> statement-breakpoint
CREATE INDEX "stock_opname_items_opname_id_idx" ON "stock_opname_items" USING btree ("opname_id");--> statement-breakpoint
CREATE INDEX "stock_opname_items_product_id_idx" ON "stock_opname_items" USING btree ("product_id");--> statement-breakpoint
CREATE INDEX "stock_opnames_status_created_at_idx" ON "stock_opnames" USING btree ("status","created_at");--> statement-breakpoint
CREATE INDEX "stock_transfer_items_transfer_id_idx" ON "stock_transfer_items" USING btree ("transfer_id");--> statement-breakpoint
CREATE INDEX "stock_transfer_items_product_id_idx" ON "stock_transfer_items" USING btree ("product_id");--> statement-breakpoint
CREATE INDEX "stock_transfers_status_created_at_idx" ON "stock_transfers" USING btree ("status","created_at");
