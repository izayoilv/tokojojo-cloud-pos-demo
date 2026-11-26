# API server

Express GraphQL API for TokoJojo.

## Status

The core PostgreSQL schema, Phase 2 auth/device/offline schema, migrations, seed,
and schema tests are implemented. The GraphQL server, auth middleware, and offline
sync flows are **not implemented yet**.

| Area                                 | State                                            |
| ------------------------------------ | ------------------------------------------------ |
| Core schema + migrations             | Implemented                                      |
| Phase 2 auth/device/offline schema   | Implemented (`0005`)                             |
| Store/receipt settings + auth nonces | Implemented (`0006`)                             |
| GraphQL contract                     | Implemented in `packages/graphql/schema.graphql` |
| Views + append-only ledger guard     | Implemented                                      |
| Development seed                     | Implemented                                      |
| GraphQL / Pothos server              | Next step                                        |
| Auth, sessions, device/offline flows | Pending — service/API work                       |

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

| Command                                 | Purpose                                 |
| --------------------------------------- | --------------------------------------- |
| `pnpm db:generate`                      | Generate a Drizzle migration            |
| `pnpm db:check`                         | Check migration consistency             |
| `pnpm db:migrate`                       | Apply pending migrations                |
| `pnpm db:seed`                          | Seed the development store (idempotent) |
| `pnpm db:studio`                        | Open Drizzle Studio                     |
| `pnpm --filter @tokojojo/api test`      | Run schema tests against `DATABASE_URL` |
| `pnpm --filter @tokojojo/graphql check` | Validate the shared GraphQL contract    |

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

The Phase 2 schema is implemented in `0005_phase2_auth_offline.sql` and the
`apps/api/src/db/schema/` files. It adds sessions, devices/device keys,
refresh/offline tokens, sync batches/events, audit events, user credential
fields, offline shift/sale fields, and `stock_opnames.submitted_at`.
`0006_store_settings_auth_nonces.sql` adds store/receipt settings and the
single-use auth nonce table.

Still pending:

- GraphQL resolvers and the Pothos schema matching `packages/graphql/schema.graphql`
- Login/refresh/enrollment/approval/offline-token issuance flows
- Session rotation/reuse detection, CSRF/cookie middleware, pepper rotation
- Native nonce endpoint and device-signature verification
- Store/receipt settings resolvers and audit events
- Offline sync engine, conflict/retry handling, and batch signature enforcement
- Audit event writers and retention jobs
- ACL UI beyond the role enum

## Contract implementation notes

The API server is not implemented yet. These rules are fixed for the server and
client implementations.

### Roles and permissions

The static matrix is `apps/api/src/auth/permissions.ts`. A test asserts that every
SDL operation has exactly one policy. Summary:

| Role        | Access                                                                                                                               |
| ----------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| `OWNER`     | All operations                                                                                                                       |
| `ADMIN`     | All operations except creating, modifying, deactivating, or resetting an `OWNER`                                                     |
| `CASHIER`   | Catalog read, customer read/write, stock read, sales read/create, shifts read/write, dashboard read, settings read                   |
| `WAREHOUSE` | Catalog read, supplier read/write, stock read/receive/adjust/transfer/opname, purchase read/write/pay, dashboard read, settings read |

OWNER/ADMIN only: discounts, returns, voids, opname approval, finance, reports,
user management, audit, device/session management, and server settings writes.

Android write scope is receive/adjust plus transfer/opname. Android never receives
`sales:create` or an offline token.

### Web authentication

- Session cookie: `__Host-tokojojo_session`, HttpOnly, Secure, SameSite=Lax, Path=/.
- CSRF cookie: `__Host-tokojojo_csrf`, readable by JavaScript, Secure, SameSite=Lax.
- Web mutations send `X-CSRF-Token`; the server compares its SHA-256 to
  `sessions.csrf_token_hash` and checks the request origin.
- Web login sends `X-Client-Platform: WEB`.
- GraphQL auth failures return HTTP 200 with `extensions.code`:
  `UNAUTHENTICATED`, `FORBIDDEN`, `DEVICE_PENDING`, or `DEVICE_REVOKED`.

### Native authentication

```text
Authorization: Bearer <PASETO access token>
X-Offline-Token: <PASETO offline token>       # upgrade/sync fallback
X-Client-Platform: ANDROID | TAURI
X-Device-Id: <uuid>
X-Device-Key-Id: <string>
X-Nonce: <base64url, 32 bytes>
X-Client-Time: <YYYY-MM-DDTHH:MM:SSZ>
X-Device-Signature: v1:<base64url Ed25519 signature>
X-Acting-User-Id: <uuid>                      # TAURI user-scoped operations
```

`X-Device-Signature` is required for native `login`, `refresh`,
`upgradeOfflineSession`, `syncOfflineBatch`, and `rotateDeviceKey`. A PENDING
device receives null tokens and no writes until an admin approves it.

### Nonce endpoint

`GET /auth/nonce` accepts `X-Device-Id` and `X-Device-Key-Id` and returns:

```json
{
  "nonce": "base64url",
  "serverTime": "2026-11-26T10:00:00Z",
  "expiresAt": "2026-11-26T10:02:00Z"
}
```

Nonces are random 32-byte values, stored only as SHA-256, single-use, and valid for
two minutes. The endpoint is rate-limited and allows PENDING devices so they can
receive `DEVICE_PENDING`; it rejects REVOKED devices.

### Device signature

The canonical string is UTF-8 with LF separators and no trailing LF:

```text
v1
<operation>
<device_id>
<key_id>
<nonce>
<client_time>
<payload_hash>
```

`operation` is `login`, `refresh`, `upgradeOfflineSession`, `syncOfflineBatch`, or
`rotateDeviceKey`. `payload_hash` is lowercase hex SHA-256 of:

| Operation               | Payload                         |
| ----------------------- | ------------------------------- |
| `login`                 | username                        |
| `refresh`               | refresh token                   |
| `upgradeOfflineSession` | offline token                   |
| `syncOfflineBatch`      | `batchHash`                     |
| `rotateDeviceKey`       | `newKeyId + ":" + newPublicKey` |

Sign the exact `X-Client-Time` and `X-Nonce` header values. A client time outside
±5 minutes returns `CLOCK_SKEW`; a reused or expired nonce returns `INVALID_NONCE`;
a bad signature returns `INVALID_SIGNATURE`. Retired keys are accepted only until
`accepted_until`.

Ed25519 public keys are base64url-encoded raw 32 bytes, no padding. Per-order
signatures use `v1:<keyId>:<base64url signature>`.

### Batch integrity

The batch canonical object is `SyncOfflineBatchInput` without `batchHash`. It uses
RFC 8785 JCS and includes the uploaded shifts and orders, including each order's
signature. `batchHash` is SHA-256 of that object. The batch signature signs
`batchHash`; a mismatch is `INVALID_SIGNATURE`. Malformed input is
`VALIDATION_FAILED`.

Per-order canonical bytes use the GraphQL wire shape without `signature`, plus the
cashier `userId` derived from `shiftId`. Omit absent optional fields; preserve array
order; keep money, quantity, and sequence values as strings.

### Principal and multi-user POS

- Web uses the session user.
- Android uses the native token subject.
- TAURI uses the device token for the terminal and `X-Acting-User-Id` from the Rust
  core for user-scoped operations. The enrolling user's role is not inherited.
- Shift-scoped operations use the shift user: `openShift` accepts `userId`,
  `currentShift` accepts `userId`, and `createSale`/`closeShift` derive the cashier
  from `shiftId`.
- `syncOfflineBatch` verifies each shift user is active and authorized; it does not
  compare that user to the token subject.
- Admin modules (users, audit, reports, finance, settings writes, device management)
  require a web session.

### Store and receipt settings

`store_settings` and `receipt_settings` are singleton tables. The server provides
the defaults; POS may override `paperSize` and `autoPrint` locally. `showPrice` and
`footerText` remain server-authoritative. Local preferences (theme, text size,
scanner feedback, biometrics, printer selection) are device-only.

`storeSettings` and `receiptSettings` are readable by authenticated roles;
`updateStoreSettings` and `updateReceiptSettings` require OWNER/ADMIN.

## Rules

- Single store: do not add `tenant_id` or multi-store columns.
- Never update or delete `stock_movements`; insert a new movement.
- Money is `bigint`; quantities are `numeric(12,3)`.
- Keep `packages/graphql/schema.graphql` and the API schema in sync.
- Do not commit `.env`, secrets, peppers, or local database files.
- Add integration tests against PostgreSQL for every schema change.
