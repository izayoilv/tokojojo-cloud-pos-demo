CREATE TYPE "public"."receipt_paper_size" AS ENUM('MM58', 'MM80');--> statement-breakpoint
CREATE TABLE "auth_nonces" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"nonce_hash" text NOT NULL,
	"device_id" uuid NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"used_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "auth_nonces_nonce_hash_unique" UNIQUE("nonce_hash"),
	CONSTRAINT "auth_nonces_expires_after_created" CHECK ("auth_nonces"."expires_at" > "auth_nonces"."created_at")
);
--> statement-breakpoint
CREATE TABLE "receipt_settings" (
	"id" boolean PRIMARY KEY DEFAULT true NOT NULL,
	"paper_size" "receipt_paper_size" DEFAULT 'MM80' NOT NULL,
	"show_price" boolean DEFAULT true NOT NULL,
	"footer_text" text,
	"auto_print" boolean DEFAULT false NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_by" uuid,
	CONSTRAINT "receipt_settings_singleton" CHECK ("receipt_settings"."id" = true)
);
--> statement-breakpoint
CREATE TABLE "store_settings" (
	"id" boolean PRIMARY KEY DEFAULT true NOT NULL,
	"store_name" text NOT NULL,
	"tagline" text,
	"address" text,
	"city" text,
	"phone" text,
	"npwp" text,
	"default_location" "stock_location" DEFAULT 'STORE' NOT NULL,
	"low_stock_guidance" text,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_by" uuid,
	CONSTRAINT "store_settings_singleton" CHECK ("store_settings"."id" = true),
	CONSTRAINT "store_settings_name_not_blank" CHECK (btrim("store_settings"."store_name") <> '')
);
--> statement-breakpoint
ALTER TABLE "auth_nonces" ADD CONSTRAINT "auth_nonces_device_id_devices_id_fk" FOREIGN KEY ("device_id") REFERENCES "public"."devices"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "receipt_settings" ADD CONSTRAINT "receipt_settings_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "store_settings" ADD CONSTRAINT "store_settings_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "auth_nonces_device_id_expires_at_idx" ON "auth_nonces" USING btree ("device_id","expires_at");--> statement-breakpoint
CREATE INDEX "auth_nonces_expires_at_idx" ON "auth_nonces" USING btree ("expires_at");
