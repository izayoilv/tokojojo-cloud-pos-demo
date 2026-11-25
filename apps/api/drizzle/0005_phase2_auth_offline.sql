CREATE TYPE "public"."device_key_status" AS ENUM('ACTIVE', 'RETIRED', 'REVOKED');--> statement-breakpoint
CREATE TYPE "public"."device_platform" AS ENUM('ANDROID', 'TAURI');--> statement-breakpoint
CREATE TYPE "public"."device_status" AS ENUM('PENDING', 'ACTIVE', 'REVOKED');--> statement-breakpoint
CREATE TYPE "public"."sale_source" AS ENUM('ONLINE', 'OFFLINE', 'GRACE');--> statement-breakpoint
CREATE TYPE "public"."shift_source" AS ENUM('ONLINE', 'OFFLINE');--> statement-breakpoint
CREATE TABLE "audit_events" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"event_type" text NOT NULL,
	"actor_user_id" uuid,
	"device_id" uuid,
	"entity_type" text,
	"entity_id" uuid,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"retention_until" timestamp with time zone NOT NULL,
	CONSTRAINT "audit_events_retention_after_created" CHECK ("audit_events"."retention_until" > "audit_events"."created_at")
);
--> statement-breakpoint
CREATE TABLE "offline_tokens" (
	"jti" uuid PRIMARY KEY NOT NULL,
	"device_id" uuid NOT NULL,
	"issued_to_user_id" uuid NOT NULL,
	"scope" text[] NOT NULL,
	"issued_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"grace_until" timestamp with time zone NOT NULL,
	"rotated_at" timestamp with time zone,
	"revoked_at" timestamp with time zone,
	"last_seen_at" timestamp with time zone,
	CONSTRAINT "offline_tokens_scope_non_empty" CHECK (cardinality("offline_tokens"."scope") > 0),
	CONSTRAINT "offline_tokens_grace_after_expiry" CHECK ("offline_tokens"."grace_until" > "offline_tokens"."expires_at")
);
--> statement-breakpoint
CREATE TABLE "refresh_tokens" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"device_id" uuid NOT NULL,
	"token_hash" text NOT NULL,
	"family_id" uuid NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"rotated_at" timestamp with time zone,
	"revoked_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "refresh_tokens_token_hash_unique" UNIQUE("token_hash")
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"user_id" uuid NOT NULL,
	"token_hash" text NOT NULL,
	"csrf_token_hash" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_seen_at" timestamp with time zone,
	"revoked_at" timestamp with time zone,
	"user_agent" text,
	"ip" text,
	CONSTRAINT "sessions_token_hash_unique" UNIQUE("token_hash"),
	CONSTRAINT "sessions_expires_after_created" CHECK ("sessions"."expires_at" > "sessions"."created_at")
);
--> statement-breakpoint
CREATE TABLE "device_keys" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"device_id" uuid NOT NULL,
	"key_id" text NOT NULL,
	"public_key" text NOT NULL,
	"key_alg" text DEFAULT 'Ed25519' NOT NULL,
	"status" "device_key_status" NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"activated_at" timestamp with time zone,
	"retired_at" timestamp with time zone,
	"accepted_until" timestamp with time zone,
	"revoked_at" timestamp with time zone,
	CONSTRAINT "device_keys_key_id_unique" UNIQUE("key_id"),
	CONSTRAINT "device_keys_key_id_not_blank" CHECK (btrim("device_keys"."key_id") <> ''),
	CONSTRAINT "device_keys_public_key_not_blank" CHECK (btrim("device_keys"."public_key") <> ''),
	CONSTRAINT "device_keys_status_fields_consistent" CHECK (("device_keys"."status" = 'ACTIVE'
          AND "device_keys"."retired_at" IS NULL
          AND "device_keys"."accepted_until" IS NULL
          AND "device_keys"."revoked_at" IS NULL)
        OR ("device_keys"."status" = 'RETIRED'
          AND "device_keys"."retired_at" IS NOT NULL
          AND "device_keys"."accepted_until" IS NOT NULL
          AND "device_keys"."revoked_at" IS NULL)
        OR ("device_keys"."status" = 'REVOKED' AND "device_keys"."revoked_at" IS NOT NULL)),
	CONSTRAINT "device_keys_accepted_until_after_retired" CHECK ("device_keys"."accepted_until" IS NULL
        OR "device_keys"."retired_at" IS NULL
        OR "device_keys"."accepted_until" > "device_keys"."retired_at")
);
--> statement-breakpoint
CREATE TABLE "devices" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"name" text NOT NULL,
	"platform" "device_platform" NOT NULL,
	"enrolled_by_user_id" uuid NOT NULL,
	"status" "device_status" DEFAULT 'PENDING' NOT NULL,
	"enrolled_at" timestamp with time zone,
	"last_seen_at" timestamp with time zone,
	"revoked_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "devices_name_not_blank" CHECK (btrim("devices"."name") <> ''),
	CONSTRAINT "devices_revoked_fields_consistent" CHECK (("devices"."status" = 'REVOKED' AND "devices"."revoked_at" IS NOT NULL)
        OR ("devices"."status" <> 'REVOKED' AND "devices"."revoked_at" IS NULL)),
	CONSTRAINT "devices_active_requires_enrolled" CHECK ("devices"."status" <> 'ACTIVE' OR "devices"."enrolled_at" IS NOT NULL)
);
--> statement-breakpoint
CREATE TABLE "device_events" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"device_id" uuid NOT NULL,
	"type" text NOT NULL,
	"actor_user_id" uuid,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sync_batches" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"device_id" uuid NOT NULL,
	"client_batch_id" uuid NOT NULL,
	"batch_hash" text NOT NULL,
	"received_at" timestamp with time zone DEFAULT now() NOT NULL,
	"accepted_count" integer DEFAULT 0 NOT NULL,
	"flagged_count" integer DEFAULT 0 NOT NULL,
	"rejected_count" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "sync_batches_counts_non_negative" CHECK ("sync_batches"."accepted_count" >= 0
        AND "sync_batches"."flagged_count" >= 0
        AND "sync_batches"."rejected_count" >= 0)
);
--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "password_pepper_version" smallint DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "password_changed_at" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "credential_version" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "stock_opnames" ADD COLUMN "submitted_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "cashier_shifts" ADD COLUMN "device_id" uuid;--> statement-breakpoint
ALTER TABLE "cashier_shifts" ADD COLUMN "source" "shift_source" DEFAULT 'ONLINE' NOT NULL;--> statement-breakpoint
ALTER TABLE "cashier_shifts" ADD COLUMN "opened_at_client" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "cashier_shifts" ADD COLUMN "closed_at_client" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "cashier_shifts" ADD COLUMN "received_at" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "sales" ADD COLUMN "source" "sale_source" DEFAULT 'ONLINE' NOT NULL;--> statement-breakpoint
ALTER TABLE "sales" ADD COLUMN "device_id" uuid;--> statement-breakpoint
ALTER TABLE "sales" ADD COLUMN "client_order_id" uuid;--> statement-breakpoint
ALTER TABLE "sales" ADD COLUMN "client_seq" bigint;--> statement-breakpoint
ALTER TABLE "sales" ADD COLUMN "client_created_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "sales" ADD COLUMN "received_at" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "sales" ADD COLUMN "signature_verified" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "sales" ADD COLUMN "price_variance" bigint DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "sales" ADD COLUMN "sync_batch_id" uuid;--> statement-breakpoint
ALTER TABLE "audit_events" ADD CONSTRAINT "audit_events_actor_user_id_users_id_fk" FOREIGN KEY ("actor_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_events" ADD CONSTRAINT "audit_events_device_id_devices_id_fk" FOREIGN KEY ("device_id") REFERENCES "public"."devices"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "offline_tokens" ADD CONSTRAINT "offline_tokens_device_id_devices_id_fk" FOREIGN KEY ("device_id") REFERENCES "public"."devices"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "offline_tokens" ADD CONSTRAINT "offline_tokens_issued_to_user_id_users_id_fk" FOREIGN KEY ("issued_to_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "refresh_tokens" ADD CONSTRAINT "refresh_tokens_device_id_devices_id_fk" FOREIGN KEY ("device_id") REFERENCES "public"."devices"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "device_keys" ADD CONSTRAINT "device_keys_device_id_devices_id_fk" FOREIGN KEY ("device_id") REFERENCES "public"."devices"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "devices" ADD CONSTRAINT "devices_enrolled_by_user_id_users_id_fk" FOREIGN KEY ("enrolled_by_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "device_events" ADD CONSTRAINT "device_events_device_id_devices_id_fk" FOREIGN KEY ("device_id") REFERENCES "public"."devices"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "device_events" ADD CONSTRAINT "device_events_actor_user_id_users_id_fk" FOREIGN KEY ("actor_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sync_batches" ADD CONSTRAINT "sync_batches_device_id_devices_id_fk" FOREIGN KEY ("device_id") REFERENCES "public"."devices"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "audit_events_created_at_idx" ON "audit_events" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "audit_events_event_type_created_at_idx" ON "audit_events" USING btree ("event_type","created_at");--> statement-breakpoint
CREATE INDEX "audit_events_actor_user_id_created_at_idx" ON "audit_events" USING btree ("actor_user_id","created_at");--> statement-breakpoint
CREATE INDEX "audit_events_device_id_created_at_idx" ON "audit_events" USING btree ("device_id","created_at");--> statement-breakpoint
CREATE INDEX "audit_events_retention_until_idx" ON "audit_events" USING btree ("retention_until");--> statement-breakpoint
CREATE INDEX "offline_tokens_device_id_idx" ON "offline_tokens" USING btree ("device_id");--> statement-breakpoint
CREATE INDEX "offline_tokens_expires_at_idx" ON "offline_tokens" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "refresh_tokens_device_id_idx" ON "refresh_tokens" USING btree ("device_id");--> statement-breakpoint
CREATE INDEX "refresh_tokens_family_id_idx" ON "refresh_tokens" USING btree ("family_id");--> statement-breakpoint
CREATE INDEX "refresh_tokens_expires_at_idx" ON "refresh_tokens" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "sessions_user_id_expires_at_idx" ON "sessions" USING btree ("user_id","expires_at");--> statement-breakpoint
CREATE INDEX "sessions_expires_at_idx" ON "sessions" USING btree ("expires_at");--> statement-breakpoint
CREATE UNIQUE INDEX "device_keys_one_active_per_device" ON "device_keys" USING btree ("device_id") WHERE "device_keys"."status" = 'ACTIVE';--> statement-breakpoint
CREATE INDEX "device_keys_device_id_status_idx" ON "device_keys" USING btree ("device_id","status");--> statement-breakpoint
CREATE INDEX "devices_status_idx" ON "devices" USING btree ("status");--> statement-breakpoint
CREATE INDEX "devices_enrolled_by_user_id_idx" ON "devices" USING btree ("enrolled_by_user_id");--> statement-breakpoint
CREATE INDEX "devices_last_seen_at_idx" ON "devices" USING btree ("last_seen_at");--> statement-breakpoint
CREATE INDEX "device_events_device_id_created_at_idx" ON "device_events" USING btree ("device_id","created_at");--> statement-breakpoint
CREATE INDEX "device_events_type_created_at_idx" ON "device_events" USING btree ("type","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "sync_batches_device_client_batch_unique" ON "sync_batches" USING btree ("device_id","client_batch_id");--> statement-breakpoint
CREATE INDEX "sync_batches_device_id_received_at_idx" ON "sync_batches" USING btree ("device_id","received_at");--> statement-breakpoint
CREATE INDEX "sync_batches_batch_hash_idx" ON "sync_batches" USING btree ("batch_hash");--> statement-breakpoint
ALTER TABLE "cashier_shifts" ADD CONSTRAINT "cashier_shifts_device_id_devices_id_fk" FOREIGN KEY ("device_id") REFERENCES "public"."devices"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sales" ADD CONSTRAINT "sales_device_id_devices_id_fk" FOREIGN KEY ("device_id") REFERENCES "public"."devices"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sales" ADD CONSTRAINT "sales_sync_batch_id_sync_batches_id_fk" FOREIGN KEY ("sync_batch_id") REFERENCES "public"."sync_batches"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "sales_device_client_order_unique" ON "sales" USING btree ("device_id","client_order_id") WHERE "sales"."client_order_id" IS NOT NULL;--> statement-breakpoint
CREATE INDEX "sales_device_id_client_seq_idx" ON "sales" USING btree ("device_id","client_seq");--> statement-breakpoint
CREATE INDEX "sales_sync_batch_id_idx" ON "sales" USING btree ("sync_batch_id");--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_password_pepper_version_positive" CHECK ("users"."password_pepper_version" > 0);--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_credential_version_positive" CHECK ("users"."credential_version" > 0);--> statement-breakpoint
ALTER TABLE "cashier_shifts" ADD CONSTRAINT "cashier_shifts_offline_fields_required" CHECK ("cashier_shifts"."source" <> 'OFFLINE'
        OR ("cashier_shifts"."device_id" IS NOT NULL
          AND "cashier_shifts"."opened_at_client" IS NOT NULL));--> statement-breakpoint
ALTER TABLE "cashier_shifts" ADD CONSTRAINT "cashier_shifts_offline_close_requires_client" CHECK ("cashier_shifts"."source" <> 'OFFLINE'
        OR "cashier_shifts"."status" <> 'CLOSED'
        OR "cashier_shifts"."closed_at_client" IS NOT NULL);--> statement-breakpoint
ALTER TABLE "sales" ADD CONSTRAINT "sales_offline_fields_required" CHECK ("sales"."source" = 'ONLINE'
        OR ("sales"."device_id" IS NOT NULL
          AND "sales"."client_order_id" IS NOT NULL
          AND "sales"."client_seq" IS NOT NULL
          AND "sales"."client_created_at" IS NOT NULL));--> statement-breakpoint
ALTER TABLE "sales" ADD CONSTRAINT "sales_client_seq_non_negative" CHECK ("sales"."client_seq" IS NULL OR "sales"."client_seq" >= 0);--> statement-breakpoint
ALTER TABLE "sales" ADD CONSTRAINT "sales_client_order_requires_device" CHECK ("sales"."client_order_id" IS NULL OR "sales"."device_id" IS NOT NULL);
