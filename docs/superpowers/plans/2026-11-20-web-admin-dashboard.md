# Web Admin Dashboard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the placeholder SolidJS app with the TokoJojo admin dashboard: login, app shell, Dashboard, Products, and Reports using typed mock data.

**Architecture:** Feature-folder SolidJS SPA. A typed mock repository simulates latency and will later be swapped for the shared GraphQL contract. Kobalte supplies accessible dialogs/menus, Tailwind 4 carries the design tokens, and hand-built SVG components render the charts.

**Tech Stack:** SolidJS 1.9, Vite 8, TypeScript 6, Tailwind 4, Kobalte 0.13, TanStack Query 5, lucide-solid, Vitest.

**Spec:** GitHub issue #3 plus `/home/rice/toko-jojo-system-design/toko_jojo_admin_web_ui.html` and the approved conversation design.

## Global Constraints

- Indonesian copy; Inter font; navy `#0F2447`, royal `#1D4ED8`, blue `#2563EB`, success `#16A34A`, amber `#F59E0B`, red `#DC2626`, background `#F4F6F9`, line `#E2E8F0`.
- No tokens in `localStorage`; mock auth session lives in memory only.
- Money is integer rupiah in the mock layer and displayed with `Intl.NumberFormat("id-ID")`.
- No GraphQL operations until `packages/graphql/schema.graphql` exists.
- Every table handles loading, empty, and error states.
- Responsive: off-canvas sidebar below 1024px, KPI grid 1/2/4 columns, horizontally scrollable tables.
- Passing commands: `pnpm --filter @tokojojo/web typecheck`, `lint`, `build`, `test`.

## Review Focus

- Long Indonesian product names and rupiah values overflow table cells and KPI cards.
- A cashier/warehouse role must not see edit/create controls or restricted nav items.
- Empty sales/product datasets must not divide by zero or render `NaN`.
- A failed mock request must show an error with retry, never a blank panel.
- Narrow viewports must keep the primary action reachable with the sidebar closed.

---

### Task 1: Test harness, formatters, calculations

**Files:**

- Modify: `apps/web/package.json`
- Create: `apps/web/vitest.config.ts`
- Create: `apps/web/src/lib/format.ts`
- Create: `apps/web/src/lib/calc.ts`
- Test: `apps/web/src/lib/format.test.ts`
- Test: `apps/web/src/lib/calc.test.ts`

**Interfaces:**

- Produces: `formatRupiah(value: number): string`, `formatDate(iso: string): string`, `formatDateTime(iso: string): string`, `formatPercent(value: number): string`, `saleTotals(sale: Sale): SaleTotals`, `stockStatus(product: Product): "AMAN" | "MENIPIS" | "HABIS"`, `inventoryValue(products: Product[]): number`, `lowStockProducts(products: Product[]): Product[]`, `salesKpis(sales: Sale[]): SalesKpis`.

- [ ] **Step 1: Add Vitest and config**

Run: `pnpm --filter @tokojojo/web add -D vitest`

Create `apps/web/vitest.config.ts` with `test: { environment: "node", include: ["src/**/*.test.ts"] }`.

- [ ] **Step 2: Write failing formatter and calculation tests**

Cover: `formatRupiah(73500) === "Rp 73.500"`, date formatting for an ISO string, `saleTotals` with item discounts and returns, `stockStatus` for safe/low/empty stock, `inventoryValue` across two locations, `lowStockProducts` exclusions, and `salesKpis` with an empty array returning zeros.

- [ ] **Step 3: Run tests to verify they fail**

Run: `pnpm --filter @tokojojo/web test -- --run`
Expected: FAIL because `format.ts` and `calc.ts` do not exist.

- [ ] **Step 4: Implement the formatters and calculations**

Use `Intl.NumberFormat("id-ID")`; guard division by zero; keep money as integers.

- [ ] **Step 5: Run tests to verify they pass**

Run: `pnpm --filter @tokojojo/web test -- --run`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add apps/web/package.json apps/web/vitest.config.ts apps/web/src/lib pnpm-lock.yaml
git commit -m "test(web): add formatter and calculation coverage"
```

### Task 2: Types, mock data, repository

**Files:**

- Create: `apps/web/src/data/types.ts`
- Create: `apps/web/src/data/mock.ts`
- Create: `apps/web/src/data/repository.ts`
- Test: `apps/web/src/data/repository.test.ts`

**Interfaces:**

- Consumes: Task 1 `calc.ts`, `format.ts`.
- Produces: domain types (`Role`, `User`, `Location`, `Product`, `Sale`, `SaleItem`, `StoreSettings`, `Transfer`, `Payable`); `repository` with `login(username, password): Promise<User>`, `listProducts(): Promise<Product[]>`, `listSales(): Promise<Sale[]>`, `listUsers(): Promise<User[]>`, `listTransfers(): Promise<Transfer[]>`, `getSettings(): Promise<StoreSettings>`.

- [ ] **Step 1: Write failing repository tests**

Assert the four demo accounts exist, `login("owner", "tokojojo123")` resolves to the OWNER user, an unknown password rejects, and `listProducts()` returns the 12 seeded SKUs with integer money.

- [ ] **Step 2: Run to verify failure**

Run: `pnpm --filter @tokojojo/web test -- --run src/data/repository.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement types, seed data, and async mock repository**

Port the seed products, sales, users, transfers, and store settings from the design HTML. Add a small `delay(ms)` so UI states are observable. Reject with `new Error("Nama pengguna atau kata sandi salah")` for bad credentials.

- [ ] **Step 4: Run tests to verify pass**

Run: `pnpm --filter @tokojojo/web test -- --run src/data/repository.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/data
git commit -m "feat(web): add typed mock repository"
```

### Task 3: Design tokens, primitives, shell, auth

**Files:**

- Modify: `apps/web/src/styles.css`
- Create: `apps/web/src/components/ui/*.tsx`
- Create: `apps/web/src/app/router.tsx`
- Create: `apps/web/src/app/AppLayout.tsx`
- Create: `apps/web/src/app/AuthProvider.tsx`
- Create: `apps/web/src/app/ToastProvider.tsx`
- Create: `apps/web/src/features/auth/LoginPage.tsx`
- Create: `apps/web/src/features/soon/SoonPage.tsx`
- Modify: `apps/web/src/App.tsx`, `apps/web/src/index.tsx`

**Interfaces:**

- Consumes: `repository.login`, `User`, `Role`.
- Produces: `useAuth(): { user, login, logout, ready }`; UI primitives `Button`, `Card`, `Pill`, `Tabs`, `DataTable`, `Modal`, `EmptyState`, `PageHeader`, `Field`; routes `/login`, `/`, `/products`, `/reports`, and `/soon/:module`.

- [ ] **Step 1: Add design tokens and base styles**

Map the HTML variables to Tailwind `@theme`, import Inter, and set the page background/typography.

- [ ] **Step 2: Build primitives**

Each primitive mirrors the design class names and supports the states used by later tasks (disabled, loading, danger, small, active tab).

- [ ] **Step 3: Build auth and shell**

Login card with role shortcuts; in-memory auth context; guarded routes; sidebar filtered by role with all ten modules and a "Segera" badge for unbuilt ones; topbar search, notifications button, user dropdown; off-canvas sidebar below `lg`; toast outlet.

- [ ] **Step 4: Verify typecheck and lint**

Run: `pnpm --filter @tokojojo/web typecheck && pnpm --filter @tokojojo/web lint`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src
git commit -m "feat(web): add design system, auth, and app shell"
```

### Task 4: Dashboard

**Files:**

- Create: `apps/web/src/features/dashboard/DashboardPage.tsx`
- Create: `apps/web/src/components/charts/SalesChart.tsx`
- Create: `apps/web/src/components/charts/StockDonut.tsx`
- Test: `apps/web/src/lib/calc.test.ts` (extend)

**Interfaces:**

- Consumes: `repository`, Task 1 calculations, Task 3 primitives.
- Produces: dashboard route rendering KPIs, date-range tabs, sales/HPP/profit chart, stock valuation donut, low-stock table, payables/pending transfers, recent sales.

- [ ] **Step 1: Extend tests for date ranges and chart aggregation**

Add `dailySalesSeries(sales, range)` and `stockValuationByLocation(products)` with an empty-array case.

- [ ] **Step 2: Run to verify failure**

Run: `pnpm --filter @tokojojo/web test -- --run src/lib/calc.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement aggregation and charts**

Pure functions first, then Solid SVG components matching the design's bars, line, and donut.

- [ ] **Step 4: Implement the page**

TanStack Query for repository reads; skeleton/empty/error blocks; range tabs `TODAY`, `7DAYS`, `MONTH`, `ALL`.

- [ ] **Step 5: Verify**

Run: `pnpm --filter @tokojojo/web test -- --run && pnpm --filter @tokojojo/web build`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add apps/web/src
git commit -m "feat(web): build admin dashboard"
```

### Task 5: Products

**Files:**

- Create: `apps/web/src/features/products/ProductsPage.tsx`
- Create: `apps/web/src/features/products/ProductFormModal.tsx`
- Create: `apps/web/src/features/products/productCsv.ts`
- Test: `apps/web/src/features/products/productCsv.test.ts`

**Interfaces:**

- Consumes: `repository.listProducts`, `Product`, Task 3 primitives.
- Produces: searchable/filterable product table, detail/edit modal, CSV export, role-gated create/edit controls.

- [ ] **Step 1: Write failing CSV test**

Assert the header row and escaping of names containing commas/quotes.

- [ ] **Step 2: Run to verify failure**

Run: `pnpm --filter @tokojojo/web test -- --run src/features/products/productCsv.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement CSV and the page**

Search by name/SKU/barcode; category and brand selects; stock-status pills; empty/error states; modal validates required name, SKU, barcode, and price > 0; cashier/warehouse roles get read-only detail.

- [ ] **Step 4: Verify**

Run: `pnpm --filter @tokojojo/web test -- --run && pnpm --filter @tokojojo/web typecheck && pnpm --filter @tokojojo/web lint`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/features/products
git commit -m "feat(web): add product catalog screens"
```

### Task 6: Reports and polish

**Files:**

- Create: `apps/web/src/features/reports/ReportsPage.tsx`
- Create: `apps/web/src/features/reports/reportCsv.ts`
- Create: `apps/web/src/features/reports/printReport.ts`
- Test: `apps/web/src/features/reports/reportCsv.test.ts`
- Modify: `apps/web/src/styles.css`

**Interfaces:**

- Consumes: Task 1 formatters, Task 5 CSV helpers, Task 3 primitives.
- Produces: ten report cards, CSV export, print view, responsive print styles.

- [ ] **Step 1: Write failing report export test**

Assert the CSV includes the report title and the current user's name, and that print HTML escapes the store name.

- [ ] **Step 2: Run to verify failure**

Run: `pnpm --filter @tokojojo/web test -- --run src/features/reports/reportCsv.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement reports**

Report cards from the design, CSV download, print-only area, escaped HTML.

- [ ] **Step 4: Final verification**

Run: `pnpm --filter @tokojojo/web test -- --run && pnpm --filter @tokojojo/web typecheck && pnpm --filter @tokojojo/web lint && pnpm --filter @tokojojo/web build && pnpm format:check`
Expected: all PASS.

- [ ] **Step 5: Manual smoke test**

Run `pnpm dev:web`, verify login, role filtering, dashboard at desktop and narrow widths, product filters/modal, report print preview.

- [ ] **Step 6: Commit**

```bash
git add apps/web/src apps/web/package.json pnpm-lock.yaml
git commit -m "feat(web): add reports and responsive polish"
```
