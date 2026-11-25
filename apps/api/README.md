# API server

Express GraphQL API for TokoJojo.

## Status

The core PostgreSQL schema, migrations, seed, and schema tests are implemented.
The GraphQL server, auth, sessions, and offline sync are **not implemented yet**.

| Area                             | State                            |
| -------------------------------- | -------------------------------- |
| Core schema + migrations         | Implemented                      |
| Views + append-only ledger guard | Implemented                      |
| Development seed                 | Implemented                      |
| GraphQL / Pothos server          | Next step                        |
| Auth, sessions, device/offline   | Phase 2 — separate design and PR |

## Stack

| Layer     | Choice                                         |
| --------- | ---------------------------------------------- |
| Runtime   | Node 26 + pnpm                                 |
| HTTP      | Express 5 (planned)                            |
| GraphQL   | GraphQL Yoga 6 (planned)                       |
| Schema    | Pothos 4.x (planned)                           |
| ORM       | Drizzle 0.45.x                                 |
| Database  | PostgreSQL 18+                                 |
| Passwords | Argon2id (seed accounts only; auth is Phase 2) |

PostgreSQL is the only service in `compose.dev.yaml` right now.

## Local database

Start PostgreSQL, copy the environment file, then migrate and seed:

```bash
cp .env.example .env
podman-compose -f compose.dev.yaml up -d

pnpm db:migrate
pnpm db:seed
```

Defaults come from `.env.example`: database `tokojojo`, user `tokojojo`,
password `tokojojo_dev`, exposed only on `127.0.0.1:5432`. Every command reads
`DATABASE_URL`; export it if you do not use the repo-root `.env`.

| Command                            | Purpose                                 |
| ---------------------------------- | --------------------------------------- |
| `pnpm db:generate`                 | Generate a Drizzle migration            |
| `pnpm db:check`                    | Check migration consistency             |
| `pnpm db:migrate`                  | Apply pending migrations                |
| `pnpm db:seed`                     | Seed the development store (idempotent) |
| `pnpm db:studio`                   | Open Drizzle Studio                     |
| `pnpm --filter @tokojojo/api test` | Run schema tests against `DATABASE_URL` |

The API package exposes the same scripts through
`pnpm --filter @tokojojo/api <command>`.

Schema reference:
[`SCHEMA.md`](SCHEMA.md) contains generated tables, columns, enums, and a Mermaid
ER diagram; [`schema.dbml`](schema.dbml) is the DBML version for dbdiagram.io or
VS Code DBML. Regenerate both with `pnpm db:docs`. Views and the append-only
guard are documented below.

### Seed

The seed creates one store's development data:

- four staff accounts: `owner`, `admin`, `kasir`, `gudang`
- the development password `tokojojo_dev`, hashed with Argon2id
- three categories, six products with units and per-location thresholds
- three suppliers
- opening stock at `WAREHOUSE` and `STORE` via `ADJUSTMENT` movements

It uses fixed UUIDs and upserts, so running it twice does not duplicate rows.
Seeding is refused when `NODE_ENV=production` unless `SEED_ALLOW=1` is set.

### Fresh database

The core schema ships as five logical migrations, `0000`–`0004`. They are
intended for a new database. A pre-merge dev database that applied the earlier
incremental chain must be reset with the compose `down -v` flow before
`pnpm db:migrate`.

Tests expect the migrations to be applied. To replay from scratch on the
disposable local compose database:

```bash
podman-compose -f compose.dev.yaml down -v
podman-compose -f compose.dev.yaml up -d

pnpm db:migrate
pnpm db:seed
pnpm db:seed
pnpm --filter @tokojojo/api test
```

`down -v` deletes the local database volume. Do not run destructive commands
against a shared or production database.

## Core schema

One database represents one store. There is **no `tenant_id`**; a second store
is a separate database/deployment.

| Group              | Tables                                                                                                      |
| ------------------ | ----------------------------------------------------------------------------------------------------------- |
| Identity / masters | `users`, `customers`, `categories`, `products`, `product_units`, `product_stock_thresholds`, `suppliers`    |
| Purchasing         | `purchases`, `purchase_items`, `purchase_payments`                                                          |
| Stock              | `stock_movements`, `stock_transfers`, `stock_transfer_items`, `stock_opnames`, `stock_opname_items`         |
| POS / finance      | `cashier_shifts`, `sales`, `sale_items`, `sale_payments`, `sale_returns`, `sale_return_items`, `cash_flows` |

Conventions:

- `uuid` primary keys default to PostgreSQL 18 `uuidv7()`.
- Money is `bigint` rupiah; quantities are `numeric(12,3)`.
- Stock has no mutable quantity columns. `stock_movements` is the source of
  truth; corrections are new movements, never edits.
- Business documents are the source of truth for why a movement exists.

## Views and guards

- `v_stock_balances(product_id, location, qty, is_negative)` sums signed
  movements per product and location. Negative stock is allowed and visible.
- `v_sale_balances` exposes `total_amount`, `total_refund`, `paid`,
  `cash_refunded`, `outstanding`, `refund_due`, and `payment_status`
  (`PAID` / `PARTIAL` / `UNPAID`). It applies design §14.2:

  ```text
  net_total   = total_amount - total_refund
  net_paid    = paid - cash_refunded
  outstanding = GREATEST(net_total - net_paid, 0)
  refund_due  = GREATEST(net_paid - net_total, 0)
  ```

  `VOIDED` sales are excluded from receivables.

- `v_purchase_balances` exposes `total_amount`, `paid`, `outstanding`, and
  `payment_status` for `OPEN` purchases. Cancelled purchases are excluded.
- A `BEFORE UPDATE OR DELETE` trigger rejects changes to `stock_movements`.
  Inserts remain allowed; append a corrective movement instead.

Document transactions (row locks, stock validation, void/return eligibility,
cash-flow generation) belong in the service layer. The schema enforces the
per-row invariants, not cross-table workflow rules.

## Phase 2

The core schema deliberately stops at the core. These are **not forgotten** and
must not be added to this PR:

- Authentication hardening, password pepper versioning/rotation
- Web sessions, refresh tokens, session rotation/reuse detection
- Device enrollment/status/revocation, device key history, and offline tokens
- ACL/permission tables beyond the core role enum
- Logging/audit tables and retention fields
- Offline sync events, batches, client IDs, retry/conflict state
- Offline shift fields and sale idempotency fields
- User credential version fields for local-credential invalidation

## Rules

- Single store: do not add `tenant_id` or multi-store columns.
- Never update or delete `stock_movements`; insert a new movement.
- Money is `bigint`; quantities are `numeric(12,3)`.
- Keep the API contract in sync with `packages/graphql/` once the server exists.
- Do not commit `.env`, secrets, peppers, or local database files.
- Add integration tests against PostgreSQL for every schema change.
