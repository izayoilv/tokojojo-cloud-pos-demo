# API server

Express GraphQL API for TokoJojo.

## Status

Placeholder. The server has **not been scaffolded yet**; there is no
`apps/api/package.json` and no `@tokojojo/api` package. The next step is the API
contract, Drizzle schema, and server scaffold.

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
