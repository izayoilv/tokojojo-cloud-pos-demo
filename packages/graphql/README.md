# Shared GraphQL contract

One schema and one set of operations for every client.

## Status

The core PostgreSQL schema is implemented. The GraphQL server is not scaffolded
yet, so `schema.graphql` and generated clients do not exist. This package becomes
the source of truth before the first feature is implemented. The Phase 2
auth/device/offline contract is the current design input.

## Source of truth

- Pothos in `apps/api` builds the schema.
- A build/export step will write `schema.graphql` here once the API exists.
- Clients generate from this schema and the operations in `operations/`.

Do not hand-edit generated models in the clients.

## Planned layout

```
packages/graphql/
  schema.graphql
  operations/
    auth.graphql
    devices.graphql
    products.graphql
    sales.graphql
    stock.graphql
    sync.graphql
  codegen.ts
```

## Codegen targets

| Client  | Tool                   | Output                             |
| ------- | ---------------------- | ---------------------------------- |
| Web     | GraphQL Code Generator | TypeScript types + typed documents |
| Android | Apollo Kotlin          | Kotlin models                      |
| POS     | `graphql_client`       | Rust request/response types        |

## Change flow

1. Change the Pothos type/resolver in `apps/api`.
2. Export `schema.graphql`.
3. Update the affected `.graphql` operations.
4. Run codegen for web, Android, and POS.
5. Typecheck each client.
6. Open one PR containing the API, schema, operations, and client changes.

Do not split a schema change and its client updates across unrelated PRs unless the
change is backward-compatible.

## Contract rules

- IDs are UUIDv7 strings.
- Money is a decimal string; never a GraphQL `Float`.
- Dates are ISO-8601 UTC strings.
- Use explicit input types; do not pass arbitrary JSON blobs.
- Add fields compatibly; coordinate before removing or renaming fields.
- Single store: every operation is authorized from the auth context; there is no
  `tenant_id` or tenant scoping.
- Roles are `OWNER`, `ADMIN`, `CASHIER`, and `WAREHOUSE`.
- Offline operations are idempotent by device + client-generated IDs (`device_id`,
  `client_order_id`); shifts sync before their sales.
