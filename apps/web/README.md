# Web admin dashboard

SolidJS single-page admin dashboard for TokoJojo.

## Demo status

The app shell, login, Dashboard, Products, and Reports run on typed mock data
from `src/data`. The remaining modules stay visible in the sidebar and route to
a "Segera hadir" page. GraphQL operations stay undefined until
`packages/graphql/schema.graphql` exists.

Demo accounts use the password `tokojojo123`:

| Username | Role      | Modules                                          |
| -------- | --------- | ------------------------------------------------ |
| `owner`  | OWNER     | All modules                                      |
| `admin`  | ADMIN     | All modules                                      |
| `kasir`  | CASHIER   | Dashboard, Produk, Persediaan, Penjualan         |
| `gudang` | WAREHOUSE | Dashboard, Produk, Persediaan, Pembelian, Gudang |

Sessions live in memory only. Refreshing the page returns to login, and no token
is written to `localStorage`.

## Stack

| Layer        | Choice                                                 |
| ------------ | ------------------------------------------------------ |
| Framework    | SolidJS 1.9.x                                          |
| Build        | Vite 8                                                 |
| Language     | TypeScript 6.0.x                                       |
| Router       | `@solidjs/router` 1.x                                  |
| Server state | TanStack Query Solid                                   |
| GraphQL      | `graphql-request` + GraphQL Code Generator             |
| UI           | Kobalte + Tailwind CSS 4                               |
| Auth         | Mock in-memory session; HttpOnly cookie + CSRF planned |

No SSR. The dashboard is a static build served by Caddy.

## Commands

```bash
pnpm --filter @tokojojo/web dev
pnpm --filter @tokojojo/web build
pnpm --filter @tokojojo/web typecheck
pnpm --filter @tokojojo/web lint
pnpm --filter @tokojojo/web test
```

The Vite dev server proxies `/graphql` to `http://localhost:3000`. The API is not
scaffolded yet, so live GraphQL calls will fail until it exists.

## Auth flow

- The demo reads seeded users through `repository.login` and keeps the session in
  a Solid signal; it is never persisted to browser storage.
- The production target remains the API's HttpOnly session cookie.
- The browser must never store access tokens in JavaScript or `localStorage`.
- Mutations will send the CSRF token required by the API.
- On 401, clear local query state and route to login.
- The dashboard and API share an origin through Caddy; do not call the native API
  hostname from the browser.

## Feature flow

1. Add or update the operation in `packages/graphql/operations`.
2. Run GraphQL Code Generator (wired when the API schema exists).
3. Use the generated document with `graphql-request`.
4. Replace the matching method in `src/data/repository.ts`; keep the existing
   promise-shaped interface so screens do not change.
5. Wrap reads/mutations with TanStack Query and invalidate affected keys.
6. Keep ACL checks server-side; UI hiding is convenience only.
7. Add a Vitest test for non-trivial state, formatting, or export logic.
8. Run typecheck, lint, format check, test, and build before opening a PR.

## UI rules

- Keep the admin shell responsive; tables must handle empty/loading/error states.
- Use Kobalte primitives and Tailwind; avoid a second component system.
- Money is integer rupiah in the mock layer. Parse GraphQL decimal strings at the
  repository boundary and keep display formatting in `src/lib/format.ts`.
- Do not treat client-side stock or price calculations as authoritative.
- Role-based navigation and controls are convenience only; the backend remains
  authoritative.

## Before PR

```bash
pnpm typecheck
pnpm lint
pnpm format:check
pnpm --filter @tokojojo/web test
pnpm --filter @tokojojo/web build
```
