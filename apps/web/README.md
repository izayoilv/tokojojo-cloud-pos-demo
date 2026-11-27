# Web admin dashboard

SolidJS single-page admin dashboard.

## Stack

| Layer        | Choice                                     |
| ------------ | ------------------------------------------ |
| Framework    | SolidJS 1.9.x                              |
| Build        | Vite 8                                     |
| Language     | TypeScript 6.0.x                           |
| Router       | `@solidjs/router` 1.x                      |
| Server state | TanStack Query Solid                       |
| GraphQL      | `graphql-request` + GraphQL Code Generator |
| UI           | Kobalte + Tailwind CSS 4                   |
| Auth         | HttpOnly cookie + CSRF token               |

No SSR. The dashboard is a static build served by Caddy.

## Commands

```bash
pnpm --filter @tokojojo/web dev
pnpm --filter @tokojojo/web build
pnpm --filter @tokojojo/web typecheck
pnpm --filter @tokojojo/web lint
```

The Vite dev server proxies `/graphql` to `http://localhost:3000`. The API is not
scaffolded yet, so data calls will fail until it exists.

## Auth flow

- Login uses the API's HttpOnly session cookie.
- The browser never stores access tokens in JavaScript or `localStorage`.
- Mutations send the CSRF token required by the API.
- On 401, clear local query state and route to login.
- The dashboard and API share an origin through Caddy; do not call the native API
  hostname from the browser.

## Feature flow

1. Add or update the operation in `packages/graphql/operations`.
2. Run GraphQL Code Generator (wired when the API schema exists).
3. Use the generated document with `graphql-request`.
4. Wrap reads/mutations with TanStack Query and invalidate affected keys.
5. Keep ACL checks server-side; UI hiding is convenience only.
6. Add a Vitest test for non-trivial state or formatting logic.
7. Run typecheck, lint, format check, and build before opening a PR.

## UI rules

- Keep the admin shell responsive; tables must handle empty/loading/error states.
- Use Kobalte primitives and Tailwind; avoid a second component system.
- Money is displayed with `Intl.NumberFormat` from decimal strings.
- Do not calculate prices or stock on the client as the source of truth.
- Role-aware navigation and actions are implemented in the UI; the backend remains authoritative for authorization.

## Before PR

```bash
pnpm typecheck
pnpm lint
pnpm format:check
pnpm --filter @tokojojo/web build
```
