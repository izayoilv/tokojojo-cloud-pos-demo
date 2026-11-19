# API server

Express GraphQL API for TokoJojo.

## Status

The core Drizzle schema, migrations, and seed data are **implemented and verified**.
Auth/session/offline-token tables and the remaining offline-sync fields are tracked
in the follow-up schema work under #2. The server has **not been scaffolded yet**;
there is no server entrypoint or GraphQL contract. The next step is the Pothos
schema and Express/Yoga server.

## Stack

| Layer       | Choice                                             |
| ----------- | -------------------------------------------------- |
| Runtime     | Node 26 + pnpm                                     |
| HTTP        | Express 5                                          |
| GraphQL     | GraphQL Yoga 6                                     |
| Schema      | Pothos 4.x                                         |
| ORM         | Drizzle 0.45.x stable                              |
| Database    | PostgreSQL 18+                                     |
| Passwords   | Argon2id (server pepper in auth follow-up)         |
| Native auth | PASETO v4.public + opaque refresh (auth follow-up) |

PostgreSQL is the only service in `compose.dev.yaml` right now.

## Local database

```bash
podman-compose -f compose.dev.yaml up -d
```

Defaults come from `.env.example`: database `tokojojo`, user `tokojojo`, password
`tokojojo_dev`, exposed only on `127.0.0.1:5432`.

Create the API's `.env` file:

```bash
cat > apps/api/.env <<EOF
DATABASE_URL=postgresql://tokojojo:tokojojo_dev@127.0.0.1:5432/tokojojo
EOF
```

## Database schema

Modular Drizzle tables live in `src/db/schema/`; `src/db/schema/index.ts` is the
barrel used by Drizzle Kit.

### Commands

| Command                                   | Purpose                                         |
| ----------------------------------------- | ----------------------------------------------- |
| `pnpm --filter @tokojojo/api db:generate` | Generate SQL migration from schema changes      |
| `pnpm --filter @tokojojo/api db:check`    | Check schema and migration snapshot consistency |
| `pnpm --filter @tokojojo/api db:migrate`  | Apply pending migrations to the database        |
| `pnpm --filter @tokojojo/api db:seed`     | Insert demo tenant, users, categories, products |
| `pnpm --filter @tokojojo/api db:studio`   | Open Drizzle Studio (visual DB browser)         |

The same commands are available from the repo root as `pnpm db:generate`,
`pnpm db:check`, `pnpm db:migrate`, `pnpm db:seed`, and `pnpm db:studio`.

### Tables (16)

| Domain        | Tables                                                            |
| ------------- | ----------------------------------------------------------------- |
| Tenant & Auth | `tenants`, `users`, `devices`, `sync_batches`, `device_events`    |
| Catalog       | `categories`, `products`, `product_units`                         |
| Sales (POS)   | `customers`, `transactions`, `transaction_items`, `debt_payments` |
| Inventory     | `suppliers`, `stock_movements`                                    |
| Finance       | `cash_flows`                                                      |
| Audit         | `activity_logs`                                                   |

### Design decisions

- **Multi-unit pricing**: `products` stores the base unit (Kg, Pcs) and current
  stock in that unit. `product_units` holds sellable variations (e.g., "Ecer 1 Kg",
  "Karung 25 Kg") with `conversion_qty` and `selling_price`. A sale decrements
  `products.current_stock` by `qty × conversion_qty`.
- **Kasbon / debt**: `transactions.payment_method = 'DEBT'` creates a receivable.
  `debt_payments` records partial/late payments. `customers.total_debt` is
  denormalized for fast lookups.
- **Cash flow separation**: `cash_flows.wallet_source` distinguishes
  `CASH_DRAWER` from `QRIS_BALANCE`, because QRIS balance cannot be used for cash
  change until withdrawn (`QRIS_WITHDRAWAL` category).
- **Offline idempotency (partial)**: `transactions` has a partial unique index on
  `(tenant_id, device_id, client_order_id)`. `sync_batches` is unique on
  `(tenant_id, device_id, client_batch_id)`, and `device_events` on
  `(tenant_id, device_id, client_event_id)`. Device signatures, client sequence,
  source/grace attribution, and sync-batch fields are part of the follow-up
  auth/offline schema work.
- **Soft delete (BR-004)**: `users`, `products`, and `categories` have `deleted_at`.
  Financial history is protected by `RESTRICT` foreign keys: deleting a sale with
  items or payments is blocked. Do not delete items or payments directly from the
  service layer; add a void/refund flow in the follow-up.
- **UUIDv7**: All primary keys use `DEFAULT uuidv7()` (native in PostgreSQL 18).
  Time-ordered, index-friendly, no extension needed.
- **Money**: All monetary columns are `numeric(14,2)`. No `float`. Core money and
  quantity invariants are enforced with `CHECK` constraints.
- **Token storage (follow-up)**: `sessions`, `refresh_tokens`, and `offline_tokens`
  are not part of this PR. They will store SHA-256 token hashes, never raw tokens.

### Seed data

`pnpm --filter @tokojojo/api db:seed` creates a demo tenant `tokojojo` with:

| Email                  | Role    | Password      |
| ---------------------- | ------- | ------------- |
| `owner@tokojojo.local` | `owner` | `password123` |
| `kasir@tokojojo.local` | `kasir` | `password123` |

Plus two categories ("Sembako" and "Minuman"), one product ("Beras Ramos", base unit
Kg), and two sellable units ("Ecer 1 Kg" and "Karung 25 Kg"). The seed is idempotent
and refuses to run with `NODE_ENV=production` unless `SEED_ALLOW=1` is set.

> ⚠️ Seed credentials are **development only**. Do not reuse in any deployed
> environment.

### Verification

```bash
# 16 tables exist
podman exec -it tokojojo-cloud-pos-demo_postgres_1 \
  psql -U tokojojo -d tokojojo -c '\dt'

# Seed users and roles
podman exec -it tokojojo-cloud-pos-demo_postgres_1 \
  psql -U tokojojo -d tokojojo -c 'SELECT email, role FROM users;'

# Seed is idempotent: run it twice, then counts must stay at 1 product / 2 units
pnpm db:seed
podman exec -it tokojojo-cloud-pos-demo_postgres_1 \
  psql -U tokojojo -d tokojojo -c \
  'SELECT (SELECT count(*) FROM products) AS products, (SELECT count(*) FROM product_units) AS units;'

# UUIDv7 (version nibble must be "7"; "4" would mean v4)
podman exec -it tokojojo-cloud-pos-demo_postgres_1 \
  psql -U tokojojo -d tokojojo -c \
  'SELECT substring(id::text, 15, 1) AS version FROM users;'

# Indexes
podman exec -it tokojojo-cloud-pos-demo_postgres_1 \
  psql -U tokojojo -d tokojojo -c \
  "SELECT tablename, indexname FROM pg_indexes WHERE schemaname='public' ORDER BY 1, 2;"
```

> **Note on `EXPLAIN ANALYZE`**: while `transactions` is empty, PostgreSQL will
> legitimately choose `Seq Scan`. Tenant-scoped indexes
> (`transactions_tenant_date_idx`, etc.) only get picked once row counts make an
> index cheaper than a scan. To force-check an index exists and is usable:
> `SET enable_seqscan = off; EXPLAIN SELECT ...;`

## Planned structure

```
apps/api/
  src/
    db/          Drizzle schema, migrations, seed
    graphql/     Pothos builder, types, queries, mutations
    auth/        login, refresh, PASETO, sessions, devices
    sync/        offline order sync and idempotency
    server.ts
```

## Feature flow

1. Add or change the Drizzle table and migration.
2. Add the Pothos type and query/mutation.
3. Put business rules in a service; keep resolvers thin.
4. Scope every query by `tenant_id` from the authenticated context.
5. Add an integration test against a disposable PostgreSQL database.
6. Export the updated `schema.graphql` for the clients.
7. Run the API build and tests before opening a PR.

Once scaffolded, the expected commands are:

```bash
pnpm --filter @tokojojo/api dev
pnpm --filter @tokojojo/api test
pnpm --filter @tokojojo/api build
```

## Rules

- Express + GraphQL + ORM are mandatory; do not replace them.
- Never trust `tenant_id`, `user_id`, or `role` from request input.
- Use decimal strings for money and UUIDv7 strings for IDs.
- Offline sync must be idempotent by `(tenant_id, device_id, client_order_id)`.
- The auth/session/offline-token tables and device signatures are a follow-up schema
  PR under #2; do not implement auth against this core schema until they land.
- Do not add Redis unless a concrete feature requires it.
- Do not build on the VPS; build the distroless image in CI.
- Keep the API contract in sync with `packages/graphql/`.

## Before PR

- API types, schema export, and tests pass.
- Schema changes are reflected in the shared contract.
- No secrets, tunnel credentials, or peppers are committed.
