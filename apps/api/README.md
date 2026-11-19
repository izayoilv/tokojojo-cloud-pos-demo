# API server

Express GraphQL API for TokoJojo.

## Status

The Drizzle schema, migrations, and seed data are **complete and verified**. The
server has **not been scaffolded yet**; there is no server entrypoint or GraphQL
contract. The next step is the Pothos schema and Express/Yoga server.

## Stack

| Layer       | Choice                            |
| ----------- | --------------------------------- |
| Runtime     | Node 26 + pnpm                    |
| HTTP        | Express 5                         |
| GraphQL     | GraphQL Yoga 6                    |
| Schema      | Pothos 4.x                        |
| ORM         | Drizzle 0.45.x stable             |
| Database    | PostgreSQL 18+                    |
| Passwords   | Argon2id + server pepper          |
| Native auth | PASETO v4.public + opaque refresh |

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
| `pnpm --filter @tokojojo/api db:migrate`  | Apply pending migrations to the database        |
| `pnpm --filter @tokojojo/api db:seed`     | Insert demo tenant, users, categories, products |
| `pnpm --filter @tokojojo/api db:studio`   | Open Drizzle Studio (visual DB browser)         |

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
- **Offline idempotency**: `transactions` has
  `UNIQUE (tenant_id, device_id, client_order_id)`. `sync_batches` and
  `device_events` use the same pattern on `(tenant_id, device_id, client_batch_id)`
  and `(tenant_id, device_id, sequence)`.
- **Soft delete (BR-004)**: `users`, `products`, `categories` have `deleted_at`.
  Rows referenced by transactions are never hard-deleted.
- **UUIDv7**: All primary keys use `DEFAULT uuidv7()` (native in PostgreSQL 18).
  Time-ordered, index-friendly, no extension needed.
- **Money**: All monetary columns are `numeric(14,2)`. No `float`.
- **Token storage**: `refresh_tokens` and `offline_tokens` store SHA-256 hashes,
  never raw tokens.

### Seed data

`pnpm --filter @tokojojo/api db:seed` creates a demo tenant `tokojojo` with:

| Email                  | Role    | Password      |
| ---------------------- | ------- | ------------- |
| `owner@tokojojo.local` | `owner` | `password123` |
| `kasir@tokojojo.local` | `kasir` | `password123` |

Plus one category ("Sembako"), one product ("Beras Ramos", base unit Kg), and two
sellable units ("Ecer 1 Kg" and "Karung 25 Kg").

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
- Offline sync must be idempotent by `(tenant_id, device_id, order_id)`.
- Do not add Redis unless a concrete feature requires it.
- Do not build on the VPS; build the distroless image in CI.
- Keep the API contract in sync with `packages/graphql/`.

## Before PR

- API types, schema export, and tests pass.
- Schema changes are reflected in the shared contract.
- No secrets, tunnel credentials, or peppers are committed.
