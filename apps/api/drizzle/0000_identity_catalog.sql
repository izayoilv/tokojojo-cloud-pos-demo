CREATE TYPE "public"."cash_flow_category" AS ENUM('SALES', 'DEBT_PAYMENT', 'REFUND', 'PURCHASE', 'EXPENSE', 'CAPITAL', 'OTHER');--> statement-breakpoint
CREATE TYPE "public"."cash_flow_reference_type" AS ENUM('SALE_PAYMENT', 'PURCHASE_PAYMENT', 'SALE_RETURN', 'PURCHASE_CANCEL', 'MANUAL');--> statement-breakpoint
CREATE TYPE "public"."cash_flow_source" AS ENUM('AUTO', 'MANUAL');--> statement-breakpoint
CREATE TYPE "public"."cash_flow_type" AS ENUM('IN', 'OUT');--> statement-breakpoint
CREATE TYPE "public"."opname_status" AS ENUM('PENDING', 'APPROVED', 'REJECTED');--> statement-breakpoint
CREATE TYPE "public"."payment_method" AS ENUM('CASH', 'QRIS', 'TRANSFER', 'DEBIT');--> statement-breakpoint
CREATE TYPE "public"."purchase_status" AS ENUM('OPEN', 'CANCELLED');--> statement-breakpoint
CREATE TYPE "public"."reference_type" AS ENUM('PURCHASE', 'SALE', 'TRANSFER', 'OPNAME', 'RETURN', 'MANUAL');--> statement-breakpoint
CREATE TYPE "public"."sale_settlement" AS ENUM('CASH', 'QRIS', 'TRANSFER', 'DEBIT', 'MIXED', 'DEBT');--> statement-breakpoint
CREATE TYPE "public"."sale_status" AS ENUM('COMPLETED', 'VOIDED');--> statement-breakpoint
CREATE TYPE "public"."shift_status" AS ENUM('OPEN', 'CLOSED');--> statement-breakpoint
CREATE TYPE "public"."stock_location" AS ENUM('WAREHOUSE', 'STORE');--> statement-breakpoint
CREATE TYPE "public"."stock_movement_type" AS ENUM('PURCHASE', 'PURCHASE_CANCEL', 'SALE', 'TRANSFER_OUT', 'TRANSFER_IN', 'OPNAME', 'RETURN', 'SALE_VOID', 'ADJUSTMENT');--> statement-breakpoint
CREATE TYPE "public"."stock_transfer_status" AS ENUM('PENDING', 'COMPLETED', 'CANCELLED');--> statement-breakpoint
CREATE TYPE "public"."user_role" AS ENUM('OWNER', 'ADMIN', 'CASHIER', 'WAREHOUSE');--> statement-breakpoint
CREATE TABLE "customers" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"name" text NOT NULL,
	"phone" text,
	"address" text,
	"notes" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "customers_name_not_blank" CHECK (btrim("customers"."name") <> '')
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"name" text NOT NULL,
	"username" text NOT NULL,
	"password_hash" text NOT NULL,
	"role" "user_role" NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_username_unique" UNIQUE("username"),
	CONSTRAINT "users_name_not_blank" CHECK (btrim("users"."name") <> ''),
	CONSTRAINT "users_username_not_blank" CHECK (btrim("users"."username") <> '')
);
--> statement-breakpoint
CREATE TABLE "categories" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"name" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "categories_name_unique" UNIQUE("name"),
	CONSTRAINT "categories_name_not_blank" CHECK (btrim("categories"."name") <> '')
);
--> statement-breakpoint
CREATE TABLE "product_stock_thresholds" (
	"product_id" uuid NOT NULL,
	"location" "stock_location" NOT NULL,
	"min_qty" numeric(12, 3) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "product_stock_thresholds_product_id_location_pk" PRIMARY KEY("product_id","location"),
	CONSTRAINT "product_stock_thresholds_min_qty_non_negative" CHECK ("product_stock_thresholds"."min_qty" >= 0)
);
--> statement-breakpoint
CREATE TABLE "product_units" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"product_id" uuid NOT NULL,
	"unit_name" text NOT NULL,
	"conversion_qty" numeric(12, 3) NOT NULL,
	"selling_price" bigint NOT NULL,
	"barcode" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "product_units_conversion_qty_positive" CHECK ("product_units"."conversion_qty" > 0),
	CONSTRAINT "product_units_selling_price_non_negative" CHECK ("product_units"."selling_price" >= 0),
	CONSTRAINT "product_units_unit_name_not_blank" CHECK (btrim("product_units"."unit_name") <> '')
);
--> statement-breakpoint
CREATE TABLE "products" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"sku" text NOT NULL,
	"name" text NOT NULL,
	"category_id" uuid NOT NULL,
	"base_unit" text NOT NULL,
	"avg_cost" bigint DEFAULT 0 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "products_sku_unique" UNIQUE("sku"),
	CONSTRAINT "products_sku_not_blank" CHECK (btrim("products"."sku") <> ''),
	CONSTRAINT "products_name_not_blank" CHECK (btrim("products"."name") <> ''),
	CONSTRAINT "products_base_unit_not_blank" CHECK (btrim("products"."base_unit") <> ''),
	CONSTRAINT "products_avg_cost_non_negative" CHECK ("products"."avg_cost" >= 0)
);
--> statement-breakpoint
CREATE TABLE "suppliers" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"name" text NOT NULL,
	"phone" text,
	"address" text,
	"notes" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "suppliers_name_not_blank" CHECK (btrim("suppliers"."name") <> '')
);
--> statement-breakpoint
ALTER TABLE "product_stock_thresholds" ADD CONSTRAINT "product_stock_thresholds_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_units" ADD CONSTRAINT "product_units_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "products" ADD CONSTRAINT "products_category_id_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "customers_name_idx" ON "customers" USING btree ("name");--> statement-breakpoint
CREATE INDEX "customers_phone_idx" ON "customers" USING btree ("phone");--> statement-breakpoint
CREATE INDEX "product_units_product_id_idx" ON "product_units" USING btree ("product_id");--> statement-breakpoint
CREATE UNIQUE INDEX "product_units_product_id_unit_name_unique" ON "product_units" USING btree ("product_id","unit_name");--> statement-breakpoint
CREATE UNIQUE INDEX "product_units_product_id_id_unique" ON "product_units" USING btree ("product_id","id");--> statement-breakpoint
CREATE UNIQUE INDEX "product_units_barcode_unique" ON "product_units" USING btree ("barcode") WHERE "product_units"."barcode" is not null;--> statement-breakpoint
CREATE INDEX "products_category_id_idx" ON "products" USING btree ("category_id");--> statement-breakpoint
CREATE INDEX "products_name_idx" ON "products" USING btree ("name");--> statement-breakpoint
CREATE INDEX "suppliers_name_idx" ON "suppliers" USING btree ("name");
