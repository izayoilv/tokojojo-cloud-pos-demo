import { A } from "@solidjs/router";
import { createQuery } from "@tanstack/solid-query";
import {
  Badge,
  Button,
  EmptyState,
  ErrorState,
  PageHeader,
  PageSkeleton,
  Panel,
  PanelBody,
  PanelHeader,
  SegmentedControl,
  Table,
  TableWrap,
  Td,
  Th,
} from "@tokojojo/ui";
import {
  ArrowRight,
  FileBarChart,
  PackagePlus,
  RefreshCw,
  ShoppingCart,
} from "lucide-solid";
import { createMemo, createSignal, For, type JSX, Show } from "solid-js";

import { useAuth } from "../../app/auth";
import { canAccess, canViewSales } from "../../app/rbac";
import { SalesChart } from "../../components/charts/SalesChart";
import { StockDonut } from "../../components/charts/StockDonut";
import { repository } from "../../data/repository";
import type { Sale } from "../../data/types";
import {
  dailySalesSeries,
  type DateRange,
  lowStockProducts,
  salesInRange,
  salesKpis,
  saleTotals,
  stockStatus,
} from "../../lib/calc";
import {
  formatCompactRupiah,
  formatDate,
  formatDateTime,
  formatPercent,
  formatRupiah,
} from "../../lib/format";

const ranges: Array<{ value: DateRange; label: string }> = [
  { value: "TODAY", label: "Hari Ini" },
  { value: "7DAYS", label: "7 Hari" },
  { value: "MONTH", label: "Bulan Ini" },
  { value: "ALL", label: "Semua" },
];

const methodTone = (method: Sale["method"]) =>
  method === "TUNAI"
    ? "success"
    : method === "QRIS"
      ? "info"
      : method === "HUTANG"
        ? "warning"
        : "violet";

function LinkButton(props: {
  href: string;
  children: JSX.Element;
  variant?: "secondary" | "ghost";
}) {
  const style = () =>
    props.variant === "ghost"
      ? "text-ink-secondary hover:bg-subtle hover:text-ink"
      : "border border-line-control bg-surface text-ink hover:bg-hover";

  return (
    <A
      href={props.href}
      class={`inline-flex h-8 cursor-pointer items-center justify-center gap-2 rounded-[6px] px-3 text-xs font-semibold whitespace-nowrap transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus ${style()}`}
    >
      {props.children}
    </A>
  );
}

function KpiCard(props: {
  label: string;
  value: string;
  foot: string;
  tone?: "default" | "success" | "warning";
}) {
  return (
    <Panel class="p-4">
      <div class="text-xs font-bold tracking-[0.06em] text-ink-muted uppercase">
        {props.label}
      </div>
      <div
        class={`mt-2 text-2xl font-extrabold tracking-tight tabular-nums ${
          props.tone === "success"
            ? "text-success"
            : props.tone === "warning"
              ? "text-warning"
              : "text-ink"
        }`}
      >
        {props.value}
      </div>
      <div class="mt-2 border-t border-line pt-2 text-xs text-ink-muted">
        {props.foot}
      </div>
    </Panel>
  );
}

export function DashboardPage() {
  const auth = useAuth();
  const [range, setRange] = createSignal<DateRange>("7DAYS");

  const productsQuery = createQuery(() => ({
    queryKey: ["products"],
    queryFn: () => repository.listProducts(),
  }));
  const salesQuery = createQuery(() => ({
    queryKey: ["sales"],
    queryFn: () => repository.listSales(),
  }));
  const payablesQuery = createQuery(() => ({
    queryKey: ["payables"],
    queryFn: () => repository.listPayables(),
  }));
  const transfersQuery = createQuery(() => ({
    queryKey: ["transfers"],
    queryFn: () => repository.listTransfers(),
  }));
  const opnamesQuery = createQuery(() => ({
    queryKey: ["opnames"],
    queryFn: () => repository.listOpnames(),
  }));

  const products = () => productsQuery.data ?? [];
  const sales = () => salesQuery.data ?? [];
  const loading = () =>
    productsQuery.isPending || salesQuery.isPending || payablesQuery.isPending;
  const failed = () =>
    productsQuery.isError || salesQuery.isError || payablesQuery.isError;

  const rangeSales = createMemo(() => salesInRange(sales(), range()));
  const kpis = createMemo(() => salesKpis(rangeSales()));
  const lowStock = createMemo(() => lowStockProducts(products()));
  const chart = createMemo(() => dailySalesSeries(sales(), range()));
  const recentSales = createMemo(() =>
    [...rangeSales()].sort((a, b) => b.time.localeCompare(a.time)).slice(0, 4),
  );
  const payables = createMemo(() =>
    (payablesQuery.data ?? []).filter((p) => p.total - p.paid > 0),
  );
  const pending = createMemo(() => {
    const transfers = (transfersQuery.data ?? []).filter(
      (t) => t.status === "PENDING",
    ).length;
    const opnames = (opnamesQuery.data ?? []).filter(
      (o) => o.status === "PENDING_REVIEW",
    ).length;
    return transfers + opnames;
  });

  const lastUpdated = createMemo(() => {
    const times = [
      ...sales().map((sale) => sale.time),
      ...(transfersQuery.data ?? []).map(
        (transfer) => transfer.completed ?? transfer.created,
      ),
      ...(opnamesQuery.data ?? []).map((opname) => opname.created),
    ].sort();
    const latest = times.at(-1);

    return latest ? formatDateTime(latest) : "Belum ada data";
  });

  const statusCounts = createMemo(() => {
    const items = products();
    return {
      aman: items.filter((p) => stockStatus(p) === "AMAN").length,
      menipis: items.filter((p) => stockStatus(p) === "MENIPIS").length,
      habis: items.filter((p) => stockStatus(p) === "HABIS").length,
    };
  });

  const role = () => auth.user()?.role;
  const canPurchasing = () =>
    role() ? canAccess(role()!, "PEMBELIAN") : false;
  const canWarehouse = () => (role() ? canAccess(role()!, "GUDANG") : false);
  const canReports = () => (role() ? canAccess(role()!, "LAPORAN") : false);
  const canSales = () => (role() ? canViewSales(role()!) : false);
  const canEditProducts = () => role() === "OWNER" || role() === "ADMIN";

  const refresh = () => {
    void productsQuery.refetch();
    void salesQuery.refetch();
    void payablesQuery.refetch();
    void transfersQuery.refetch();
    void opnamesQuery.refetch();
  };

  return (
    <>
      <PageHeader
        eyebrow="Toko Jojo · Batam Centre"
        title="Ringkasan"
        subtitle={`Terakhir diperbarui ${lastUpdated()}`}
        actions={
          <>
            <Show when={canSales()}>
              <SegmentedControl
                value={range()}
                onChange={setRange}
                items={ranges}
                label="Rentang tanggal"
              />
            </Show>
            <Button size="sm" onClick={refresh}>
              <RefreshCw size={14} /> Muat ulang
            </Button>
          </>
        }
      />

      <Show
        when={!failed()}
        fallback={
          <Panel>
            <ErrorState
              message="Ringkasan tidak dapat dimuat."
              onRetry={refresh}
            />
          </Panel>
        }
      >
        <Show when={!loading()} fallback={<PageSkeleton />}>
          <div class="space-y-3">
            <Show
              when={canSales()}
              fallback={
                <div class="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
                  <KpiCard
                    label="Total SKU"
                    value={String(products().length)}
                    foot="Produk di katalog"
                  />
                  <KpiCard
                    label="Stok menipis"
                    value={String(statusCounts().menipis)}
                    foot="Perlu restock"
                    tone="warning"
                  />
                  <KpiCard
                    label="Stok habis"
                    value={String(statusCounts().habis)}
                    foot="Segera restock"
                    tone="warning"
                  />
                  <KpiCard
                    label="Hutang supplier"
                    value={formatCompactRupiah(
                      payables().reduce(
                        (sum, payable) => sum + payable.total - payable.paid,
                        0,
                      ),
                    )}
                    foot={`${payables().length} supplier`}
                  />
                </div>
              }
            >
              <div class="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
                <KpiCard
                  label="Penjualan"
                  value={formatCompactRupiah(kpis().revenue)}
                  foot={`${rangeSales().length} transaksi`}
                />
                <KpiCard
                  label="HPP"
                  value={formatCompactRupiah(kpis().cogs)}
                  foot={
                    kpis().revenue === 0
                      ? "Belum ada penjualan"
                      : `${formatPercent((kpis().cogs / kpis().revenue) * 100)} dari penjualan`
                  }
                />
                <KpiCard
                  label="Laba kotor"
                  value={formatCompactRupiah(kpis().grossProfit)}
                  foot="Penjualan − HPP"
                  tone="success"
                />
                <KpiCard
                  label="Margin"
                  value={formatPercent(kpis().margin)}
                  foot="Target 30%"
                />
              </div>
            </Show>

            <div class="flex flex-wrap gap-2">
              <Show when={canEditProducts()}>
                <LinkButton href="/produk">
                  <PackagePlus size={14} /> Tambah Produk
                </LinkButton>
              </Show>
              <Show when={canPurchasing()}>
                <LinkButton href="/pembelian">
                  <ShoppingCart size={14} /> Buat Pembelian
                </LinkButton>
              </Show>
              <Show when={canReports()}>
                <LinkButton href="/laporan">
                  <FileBarChart size={14} /> Lihat Laporan
                </LinkButton>
              </Show>
            </div>

            <div
              class={`grid grid-cols-1 gap-3 ${
                canSales() ? "xl:grid-cols-[1.7fr_1fr]" : ""
              }`}
            >
              <Show when={canSales()}>
                <Panel>
                  <PanelHeader
                    title="Tren penjualan"
                    description={ranges.find((r) => r.value === range())?.label}
                    actions={
                      <Badge tone={kpis().margin >= 30 ? "success" : "warning"}>
                        Margin {formatPercent(kpis().margin)}
                      </Badge>
                    }
                  />
                  <PanelBody>
                    <SalesChart points={chart()} />
                  </PanelBody>
                </Panel>
              </Show>

              <Panel>
                <PanelHeader
                  title="Status stok"
                  actions={
                    <Badge tone="warning">
                      {statusCounts().menipis} menipis
                    </Badge>
                  }
                />
                <PanelBody>
                  <StockDonut
                    slices={[
                      {
                        label: "Aman",
                        value: statusCounts().aman,
                        color: "var(--tj-chart-1)",
                      },
                      {
                        label: "Menipis",
                        value: statusCounts().menipis,
                        color: "var(--tj-chart-2)",
                      },
                      {
                        label: "Habis",
                        value: statusCounts().habis,
                        color: "var(--tj-chart-4)",
                      },
                    ]}
                  />
                </PanelBody>
              </Panel>
            </div>

            <div class="grid grid-cols-1 gap-3 xl:grid-cols-2">
              <Panel>
                <PanelHeader
                  title="Stok menipis"
                  actions={
                    <LinkButton href="/persediaan" variant="ghost">
                      Lihat semua <ArrowRight size={14} />
                    </LinkButton>
                  }
                />
                <Show
                  when={lowStock().length > 0}
                  fallback={
                    <EmptyState
                      title="Stok aman"
                      description="Tidak ada produk di bawah threshold."
                    />
                  }
                >
                  <TableWrap>
                    <Table class="min-w-[520px]">
                      <thead>
                        <tr>
                          <Th>Produk</Th>
                          <Th align="right">Stok</Th>
                          <Th align="right">Min</Th>
                          <Th>Status</Th>
                        </tr>
                      </thead>
                      <tbody>
                        <For each={lowStock().slice(0, 5)}>
                          {(product) => (
                            <tr class="hover:bg-hover">
                              <Td>
                                <b class="text-ink">{product.name}</b>
                                <div class="font-mono text-[11px] text-ink-muted">
                                  {product.sku}
                                </div>
                              </Td>
                              <Td align="right">
                                {product.storeStock + product.warehouseStock}
                              </Td>
                              <Td align="right">{product.minStock}</Td>
                              <Td>
                                <Badge
                                  tone={
                                    stockStatus(product) === "HABIS"
                                      ? "danger"
                                      : "warning"
                                  }
                                >
                                  {stockStatus(product) === "HABIS"
                                    ? "Habis"
                                    : "Menipis"}
                                </Badge>
                              </Td>
                            </tr>
                          )}
                        </For>
                      </tbody>
                    </Table>
                  </TableWrap>
                </Show>
              </Panel>

              <Show when={canPurchasing()}>
                <Panel>
                  <PanelHeader
                    title="Hutang jatuh tempo"
                    actions={
                      <LinkButton href="/pembelian" variant="ghost">
                        Lihat semua <ArrowRight size={14} />
                      </LinkButton>
                    }
                  />
                  <PanelBody class="space-y-3">
                    <For each={payables()}>
                      {(payable) => (
                        <div class="flex items-center justify-between gap-3 border-b border-line pb-3 last:border-0 last:pb-0">
                          <div class="min-w-0">
                            <div class="truncate text-sm font-semibold text-ink">
                              {payable.supplierName}
                            </div>
                            <div class="text-xs text-ink-muted">
                              {payable.invoice} · jatuh tempo{" "}
                              <b class="text-danger">
                                {formatDate(payable.due)}
                              </b>
                            </div>
                          </div>
                          <div class="shrink-0 text-right">
                            <div class="text-sm font-bold tabular-nums text-ink">
                              {formatRupiah(payable.total - payable.paid)}
                            </div>
                            <Badge tone="danger">
                              {payable.status === "PARTIAL"
                                ? "Cicilan"
                                : "Belum bayar"}
                            </Badge>
                          </div>
                        </div>
                      )}
                    </For>
                    <Show when={payables().length === 0}>
                      <EmptyState
                        title="Tidak ada hutang"
                        description="Semua hutang supplier sudah dibayar."
                      />
                    </Show>
                  </PanelBody>
                </Panel>
              </Show>
            </div>

            <div
              class={`grid grid-cols-1 gap-3 ${
                canSales() && canWarehouse() ? "xl:grid-cols-2" : ""
              }`}
            >
              <Show when={canSales()}>
                <Panel>
                  <PanelHeader
                    title="Penjualan terbaru"
                    actions={
                      <LinkButton href="/penjualan" variant="ghost">
                        Lihat semua <ArrowRight size={14} />
                      </LinkButton>
                    }
                  />
                  <TableWrap>
                    <Table class="min-w-[560px]">
                      <thead>
                        <tr>
                          <Th>Invoice</Th>
                          <Th>Kasir</Th>
                          <Th>Metode</Th>
                          <Th align="right">Total</Th>
                          <Th>Status</Th>
                        </tr>
                      </thead>
                      <tbody>
                        <For each={recentSales()}>
                          {(sale) => (
                            <tr class="hover:bg-hover">
                              <Td class="font-mono text-[11px]">
                                {sale.number}
                              </Td>
                              <Td>{sale.cashier.split(" ")[0]}</Td>
                              <Td>
                                <Badge tone={methodTone(sale.method)}>
                                  {sale.method}
                                </Badge>
                              </Td>
                              <Td align="right">
                                {formatRupiah(saleTotals(sale).grandTotal)}
                              </Td>
                              <Td>
                                <Badge
                                  tone={
                                    sale.status === "COMPLETED"
                                      ? "success"
                                      : "warning"
                                  }
                                >
                                  {sale.status === "COMPLETED"
                                    ? "Selesai"
                                    : "Sebagian"}
                                </Badge>
                              </Td>
                            </tr>
                          )}
                        </For>
                      </tbody>
                    </Table>
                  </TableWrap>
                  <Show when={recentSales().length === 0}>
                    <EmptyState
                      title="Belum ada penjualan"
                      description="Transaksi POS yang tersinkron akan muncul di sini."
                    />
                  </Show>
                </Panel>
              </Show>

              <Show when={canWarehouse()}>
                <Panel>
                  <PanelHeader
                    title="Menunggu persetujuan"
                    actions={<Badge tone="info">{pending()}</Badge>}
                  />
                  <PanelBody class="space-y-3">
                    <For
                      each={(transfersQuery.data ?? []).filter(
                        (t) => t.status === "PENDING",
                      )}
                    >
                      {(transfer) => (
                        <div class="flex items-center justify-between gap-3 border-b border-line pb-3 last:border-0">
                          <div>
                            <div class="text-sm font-semibold text-ink">
                              Mutasi {transfer.number}
                            </div>
                            <div class="text-xs text-ink-muted">
                              {transfer.from} → {transfer.to} ·{" "}
                              {transfer.itemCount} item
                            </div>
                          </div>
                          <LinkButton href="/gudang">Tinjau</LinkButton>
                        </div>
                      )}
                    </For>
                    <For
                      each={(opnamesQuery.data ?? []).filter(
                        (o) => o.status === "PENDING_REVIEW",
                      )}
                    >
                      {(opname) => (
                        <div class="flex items-center justify-between gap-3 border-b border-line pb-3 last:border-0">
                          <div>
                            <div class="text-sm font-semibold text-ink">
                              Opname {opname.number}
                            </div>
                            <div class="text-xs text-ink-muted">
                              {opname.location} · {opname.items.length} item
                            </div>
                          </div>
                          <LinkButton href="/gudang">Tinjau</LinkButton>
                        </div>
                      )}
                    </For>
                    <Show when={pending() === 0}>
                      <EmptyState
                        title="Tidak ada persetujuan tertunda"
                        description="Mutasi dan opname sudah ditinjau."
                      />
                    </Show>
                  </PanelBody>
                </Panel>
              </Show>
            </div>

            <div class="text-right text-xs text-ink-muted">
              Data terakhir: 24 Nov 2026, 14:30 WIB
            </div>
          </div>
        </Show>
      </Show>
    </>
  );
}
