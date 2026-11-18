# Shared GraphQL contract

One schema and one set of operations for every client.

## Status

Placeholder. The API is not scaffolded yet, so `schema.graphql` and generated
clients do not exist. This package becomes the source of truth before the first
feature is implemented.

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
    products.graphql
    sales.graphql
    stock.graphql
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
- Every operation is tenant-scoped by the server from auth context.
- Offline operations are idempotent by client-generated order IDs.
