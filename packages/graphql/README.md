# Shared GraphQL contract

One schema and one set of operations for every client.

## Status

**Contract defined; API server pending.** `schema.graphql` is the written
contract for the whole screen-to-API matrix plus the Phase 2
auth/device/offline/sync surface. No GraphQL server, resolvers, or generated
clients exist yet. Pothos in `apps/api` must match this SDL exactly when the
API is implemented; a build/export step will then verify the exported schema
against this file.

Validate the contract with:

```bash
pnpm --filter @tokojojo/graphql check
```

The checker parses and validates the SDL with `graphql@16.14.2`, rejects any
`tenant` name, requires both roots, every operation in the matrix, the Phase 2
types/enums/fields, `{ items, pageInfo }` list payloads, and bans `Float`.

## Layout

```
packages/graphql/
  schema.graphql          # the contract (hand-written until the API exists)
  scripts/check-schema.mjs
  operations/             # client operation documents, added by client integration
```

Operation documents (`.graphql` queries/mutations per client) are added by the
client integration work (web #12, Android #13, POS #8), not here. This package
owns only the schema and its validation.

## Schema authorship

Until the Pothos server in #7 is stable, `schema.graphql` is the reviewed contract:
change it first, then make Pothos match. After #7, Pothos becomes the authoring
source and CI exports the SDL and fails on drift against this file. Do not maintain
two hand-edited schemas.

## Conventions

- **Single store.** One database is one store. Authorization comes from the
  auth context; there is no `tenant`/`tenantId` field anywhere.
- **IDs** are UUIDv7 strings exposed as `ID`; never parse them as numbers.
- **Money** is a decimal rupiah string (`String`); never GraphQL `Float`.
- **Quantities** are decimal strings (`numeric(12,3)` on the server).
- **Dates** are ISO-8601 UTC via the `DateTime` scalar; clients display WIB.
  Calendar-date columns (`dueDate`, report day buckets) are `YYYY-MM-DD`
  strings because the database stores `date`, not `timestamptz`.
- **Pagination** is offset-based: `PageInput { page, pageSize }` with
  `pageSize` max 100 (default 20); `PageInfo { page, pageSize, total,
totalPages }`; every list payload is `{ items, pageInfo }`.
- **Sorting** is `SortInput { field, direction }`; allowed fields are defined
  per query by the API implementation.
- **Filters** are explicit input types; no arbitrary JSON blobs in inputs.
- **Roles** are `OWNER`, `ADMIN`, `CASHIER`, `WAREHOUSE`.
- **Offline idempotency** is device + client-generated IDs:
  `(deviceId, clientOrderId)` for orders, `(deviceId, clientBatchId)` for
  batches; client-generated shift ids are accepted idempotently. Shifts sync
  before their sales; `sales.shiftId` stays required.
- **Multi-unit:** sale and receive line inputs always carry `productUnitId`
  (even for single-unit products); the server derives `qtyBase`.
- Add fields compatibly; coordinate before removing or renaming fields.

## Operations

The SDL covers every group in the UI matrix (`ui/screens.md`):

- Auth/devices: `login`, `logout`, `me`, `refresh`, `enrollDevice`,
  `approveDevice`, `revokeDevice`, `rotateDeviceKey`, `upgradeOfflineSession`,
  `revokeSession`, `sessions`, `device`, `devices`, `syncStatus`
- Catalog: `products`, `product`, `createProduct`, `updateProduct`,
  `setProductActive`, `categories`, `createCategory`, `updateCategory`,
  `suppliers`, `supplier`, `createSupplier`, `updateSupplier`,
  `setSupplierActive`, `customers`, `customer`, `createCustomer`,
  `updateCustomer`, `setCustomerActive`, `catalogSync`
- Inventory: `stockBalances`, `stockMovements`, `lowStockProducts`,
  `stockSummary`, `receiveStock`, `adjustStock`, `transfers`, `transfer`,
  `createTransfer`, `completeTransfer`, `cancelTransfer`, `opnames`, `opname`,
  `createOpname`, `updateOpname`, `submitOpname`, `approveOpname`,
  `rejectOpname`
- Purchasing: `purchases`, `purchase`, `createPurchase`, `cancelPurchase`,
  `addPurchasePayment`, `payables`
- Sales: `sales`, `sale`, `createSale`, `createSaleReturn`, `voidSale`,
  `receivables`, `shifts`, `shift`, `currentShift`, `openShift`, `closeShift`,
  `cashFlows`, `createCashFlow`
- Reports: `dashboardSummary`, `salesReport`, `inventoryReport`,
  `financeReport`
- Administration: `users`, `user`, `createUser`, `updateUser`,
  `setUserActive`, `resetUserPassword`, `auditEvents`, `storeSettings`,
  `updateStoreSettings`, `receiptSettings`, `updateReceiptSettings`
- Sync: `syncOfflineBatch`

### Contract notes and additions

Decisions made while writing the SDL, beyond the literal matrix:

- `voidSale(id, reason)` takes a `reason` argument: the core schema requires
  `void_reason` on every voided sale, and the UI void modal collects it.
- `approveDevice`/`devices` close the Phase 2 contract gap (enrollment existed
  without an admin approval mutation). Approving a `PENDING` device activates
  its key; Android/POS never receive an offline token before approval.
- `StoreSettings.lowStockGuidance` is store-wide guidance. Per-product thresholds
  remain in `product_stock_thresholds`.
- `OpenShiftInput.userId` and `currentShift(userId)` support multiple local POS
  users. The device token identifies the terminal; the shift identifies the cashier.
  `createSale` and `closeShift` derive the cashier from `shiftId`.
- `submitOpname` finalizes a count for review. The core opname enum is
  `PENDING/APPROVED/REJECTED` (no draft state), so submit keeps `PENDING` and
  sets `submittedAt`. While `submittedAt` is set, the service locks item
  updates: `updateOpname` fails with `CONFLICT`. Approval appends `OPNAME`
  movements; rejection changes no stock.
- `Sale.clientSeq` is a string on the wire (DB `bigint`); clients parse it as a
  monotonic per-device counter. `Sale.priceVariance` is a
  decimal rupiah string: the variance between client prices and the server
  catalog at sync time.
- `createSale` returns `SalePayload { sale, duplicate }`; `duplicate = true`
  marks an idempotent replay so stock is never double-decremented.
  `settlementMethod` is always server-derived, never client input.
- `receiveStock`/`adjustStock` return `StockPayload { purchase, opname,
movements }`. Receiving creates a purchase + `PURCHASE` movements in one
  transaction (supplier required in v1); adjustment creates a `PENDING`
  opname and appends movements only after approval.
- `catalogSync(since)` returns changed products (with units/barcodes/prices/
  thresholds), categories, and suppliers plus `tombstones`; archived masters
  arrive with `isActive = false`. Null `since` means a full snapshot.
- `resetUserPassword` returns `{ user, temporaryPassword }` shown once; there
  is no email service in the course stack.
- `User.lastLoginAt` and `Customer.outstandingReceivable` are derived reads
  (sessions / `v_sale_balances`), not stored columns.
- `Sale.paid/outstanding/paymentStatus` come from `v_sale_balances` and are
  null for `VOIDED` sales; `Payable`/`Receivable` expose the
  `v_purchase_balances`/`v_sale_balances` shapes with filters and pagination.
- `Purchase.paid/outstanding/paymentStatus` are derived from
  `v_purchase_balances`, which covers `OPEN` purchases. CANCELLED purchases
  resolve to zero/`UNPAID` in the service.
- `SyncItemResult.code` carries one of the error codes below; rejected items
  go to client quarantine, never silently dropped.
- `createSale` must persist the authenticated device's `deviceId` whenever
  `clientOrderId` is present. The partial unique index is NULL-distinct, so a
  client order without a device would escape idempotency.
- A `device_keys` row can be ACTIVE while its device is still PENDING; the
  service must not issue tokens or accept writes until the device is ACTIVE.
- `stock_opnames.submitted_at` is exposed as `StockOpname.submittedAt`; it is
  set by `submitOpname` and locks item updates while non-null.
- `StoreSettings`/`ReceiptSettings` persistence is not in the Phase 2
  migration; storage lands with the API implementation (#7). The contract
  shape is fixed here.
- Prettier formats `.graphql` natively, so the schema is checked by
  `pnpm format:check` like every other file (no `.prettierignore` entry).

## Error codes

Errors are returned in `extensions.code` (never as a schema enum). The UI
maps each code to plain Indonesian copy and a next action:

| Code                    | UI copy                                    | Next action                              |
| ----------------------- | ------------------------------------------ | ---------------------------------------- |
| `UNAUTHENTICATED`       | Sesi berakhir. Silakan masuk kembali.      | Redirect to login/lock.                  |
| `DEVICE_REVOKED`        | Perangkat dicabut. Hubungi admin.          | Wipe tokens, block writes.               |
| `USER_DISABLED`         | Akun dinonaktifkan. Hubungi admin.         | Logout.                                  |
| `OFFLINE_TOKEN_EXPIRED` | Masa offline berakhir.                     | Sync; request a new offline token.       |
| `GRACE_EXPIRED`         | Masa tenggang berakhir. POS terkunci.      | Online re-auth.                          |
| `INVALID_SIGNATURE`     | Tanda tangan transaksi tidak valid.        | Quarantine; contact admin.               |
| `INVALID_NONCE`         | Permintaan tidak valid.                    | Retry once; then contact admin.          |
| `CLOCK_SKEW`            | Waktu perangkat tidak sinkron.             | Show clock warning; use server time.     |
| `RATE_LIMITED`          | Terlalu banyak percobaan. Coba lagi nanti. | Backoff.                                 |
| `DUPLICATE_ORDER`       | Transaksi sudah tersinkron.                | Mark duplicate; do not double-decrement. |
| `ORDER_FLAGGED`         | Transaksi ditandai untuk ditinjau.         | Show flag reason.                        |
| `QUEUE_LIMIT`           | Antrean offline penuh.                     | Block new sales; sync.                   |
| `FORBIDDEN`             | Anda tidak punya akses.                    | 403 / hide action.                       |
| `SHIFT_NOT_FOUND`       | Shift tidak ditemukan.                     | Open a shift.                            |
| `SHIFT_CLOSED`          | Shift sudah ditutup.                       | Open a new shift.                        |
| `SHIFT_SYNC_REQUIRED`   | Shift harus disinkronkan dulu.             | Sync shifts before sales.                |
| `INVALID_SHIFT`         | Shift tidak valid.                         | Re-open/verify.                          |
| `VALIDATION_FAILED`     | Periksa kembali isian.                     | Inline field errors.                     |
| `NOT_FOUND`             | Data tidak ditemukan.                      | 404/empty state.                         |
| `CONFLICT`              | Data sudah berubah.                        | Refresh and retry.                       |
| `PENDING_APPROVAL`      | Menunggu persetujuan OWNER/ADMIN.          | Show pending banner.                     |
| `DEVICE_PENDING`        | Perangkat menunggu persetujuan admin.      | Block writes; retry.                     |
| `STALE_CATALOG`         | Katalog perlu diperbarui.                  | Run `catalogSync`.                       |
| `SYNC_REJECTED`         | Transaksi ditolak saat sinkronisasi.       | Quarantine; show reason.                 |

## Change flow

1. Change `schema.graphql` here first (contract first) and run `check`.
2. Implement the matching Pothos type/resolver in `apps/api`; the exported
   schema must match this SDL.
3. Update the affected `.graphql` operations in `operations/`.
4. Run codegen for web, Android, and POS.
5. Typecheck each client.
6. Open one PR containing the API, schema, operations, and client changes.

Do not split a schema change and its client updates across unrelated PRs
unless the change is backward-compatible. Do not hand-edit generated models
in the clients.

## Codegen targets

| Client  | Tool                   | Output                             |
| ------- | ---------------------- | ---------------------------------- |
| Web     | GraphQL Code Generator | TypeScript types + typed documents |
| Android | Apollo Kotlin          | Kotlin models                      |
| POS     | `graphql_client`       | Rust request/response types        |
