import { A, useNavigate } from "@solidjs/router";
import { createQuery } from "@tanstack/solid-query";
import {
  AlertTriangle,
  Boxes,
  ClipboardList,
  TrendingUp,
  Wallet,
} from "lucide-solid";
import type { JSX } from "solid-js";
import { createMemo, createSignal, For, Show } from "solid-js";

import { useAuth } from "../../app/auth";
import { canAccess } from "../../app/rbac";
import { SalesChart } from "../../components/charts/SalesChart";
import { StockDonut } from "../../components/charts/StockDonut";
import { Button } from "../../components/ui/Button";
import { Card, CardBody, CardHeader } from "../../components/ui/Card";
import { EmptyState } from "../../components/ui/EmptyState";
import { ErrorState } from "../../components/ui/ErrorState";
import { Modal } from "../../components/ui/Modal";
import { PageHeader } from "../../components/ui/PageHeader";
import { Pill } from "../../components/ui/Pill";
import { Skeleton } from "../../components/ui/Skeleton";
import { Tabs } from "../../components/ui/Tabs";
import { repository } from "../../data/repository";
import type { Sale } from "../../data/types";
import {
  dailySalesSeries,
  type DateRange,
  inventoryValue,
  lowStockProducts,
  retailValue,
  salesInRange,
  salesKpis,
  saleTotals,
  stockStatus,
  stockValuationByLocation,
  totalStock,
} from "../../lib/calc";
import {
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

function KpiCard(props: {
  label: string;
  value: JSX.Element;
  footer: JSX.Element;
  color: string;
  icon: JSX.Element;
}) {
  return (
    <Card class="px-[17px] py-[15px]">
      <div class="flex items-center justify-between gap-2">
        <span class="text-[11px] font-bold tracking-[.04em] text-muted uppercase">
          {props.label}
        </span>
        <span
          class="flex size-[30px] shrink-0 items-center justify-center rounded-lg"
          style={{ background: `${props.color}16`, color: props.color }}
        >
          {props.icon}
        </span>
      </div>
      <div class="mt-2 text-[22px] font-extrabold tracking-[-.01em] tabular-nums text-ink">
        {props.value}
      </div>
      <div class="mt-[9px] flex flex-wrap justify-between gap-1.5 border-t border-slate-100 pt-[9px] text-[11.5px] text-muted">
        {props.footer}
      </div>
    </Card>
  );
}

function methodTone(method: Sale["method"]) {
  if (method === "TUNAI") return "green" as const;
  if (method === "QRIS") return "blue" as const;
  return "purple" as const;
}

export function DashboardPage() {
  const auth = useAuth();
  const navigate = useNavigate();
  const [range, setRange] = createSignal<DateRange>("7DAYS");
  const [detail, setDetail] = createSignal<Sale | null>(null);

  const productsQuery = createQuery(() => ({
    queryKey: ["products"],
    queryFn: () => repository.listProducts(),
  }));
  const salesQuery = createQuery(() => ({
    queryKey: ["sales"],
    queryFn: () => repository.listSales(),
  }));
  const transfersQuery = createQuery(() => ({
    queryKey: ["transfers"],
    queryFn: () => repository.listTransfers(),
  }));
  const payablesQuery = createQuery(() => ({
    queryKey: ["payables"],
    queryFn: () => repository.listPayables(),
  }));

  const products = () => productsQuery.data ?? [];
  const sales = () => salesQuery.data ?? [];
  const loading = () => productsQuery.isPending || salesQuery.isPending;
  const failed = () => productsQuery.isError || salesQuery.isError;

  const filteredSales = createMemo(() => salesInRange(sales(), range()));
  const kpis = createMemo(() => salesKpis(filteredSales()));
  const lowStock = createMemo(() => lowStockProducts(products()));
  const outOfStock = createMemo(
    () => lowStock().filter((product) => totalStock(product) === 0).length,
  );
  const payables = createMemo(() =>
    (payablesQuery.data ?? []).filter(
      (payable) => payable.total - payable.paid > 0,
    ),
  );
  const payablesTotal = createMemo(() =>
    payables().reduce(
      (total, payable) => total + payable.total - payable.paid,
      0,
    ),
  );
  const pendingTransfers = createMemo(() =>
    (transfersQuery.data ?? []).filter(
      (transfer) => transfer.status === "PENDING",
    ),
  );
  const recentSales = createMemo(() =>
    [...filteredSales()]
      .sort((a, b) => b.time.localeCompare(a.time))
      .slice(0, 6),
  );
  const chartPoints = createMemo(() => dailySalesSeries(sales(), range()));
  const valuation = createMemo(() => stockValuationByLocation(products()));

  const retry = () => {
    void productsQuery.refetch();
    void salesQuery.refetch();
  };

  const canSeeWarehouse = () =>
    auth.user() ? canAccess(auth.user()!.role, "WAREHOUSE") : false;
  const canSeePurchasing = () =>
    auth.user() ? canAccess(auth.user()!.role, "PURCHASING") : false;
  const canSeeSales = () =>
    auth.user() ? canAccess(auth.user()!.role, "SALES") : false;

  const lowStockTarget = (stockInWarehouse: boolean) => {
    if (stockInWarehouse && canSeeWarehouse()) {
      return "/soon/warehouse";
    }
    if (!stockInWarehouse && canSeePurchasing()) {
      return "/soon/purchasing";
    }
    return "/products";
  };

  return (
    <>
      <PageHeader
        eyebrow="Ruko Operasional Aktif • WH-BACK & STORE-FRONT"
        title="Ringkasan Eksekutif TOKO JOJO"
        subtitle="Data contoh — angka mengikuti transaksi terakhir yang tersedia"
        actions={<Tabs value={range()} onChange={setRange} items={ranges} />}
      />

      <Show
        when={!failed()}
        fallback={
          <Card>
            <ErrorState
              message="Ringkasan dashboard tidak dapat dimuat dari penyimpanan contoh."
              onRetry={retry}
            />
          </Card>
        }
      >
        <Show
          when={!loading()}
          fallback={
            <>
              <div class="mb-4 grid grid-cols-1 gap-3.5 sm:grid-cols-2 xl:grid-cols-4">
                <For each={[0, 1, 2, 3]}>
                  {() => (
                    <Card class="px-[17px] py-[15px]">
                      <Skeleton class="h-3 w-28" />
                      <Skeleton class="mt-3 h-6 w-36" />
                      <Skeleton class="mt-4 h-3 w-full" />
                    </Card>
                  )}
                </For>
              </div>
              <div class="mb-4 grid gap-4 xl:grid-cols-[2fr_1fr]">
                <Card class="h-[320px] p-4">
                  <Skeleton class="h-full w-full" />
                </Card>
                <Card class="h-[320px] p-4">
                  <Skeleton class="h-full w-full" />
                </Card>
              </div>
            </>
          }
        >
          <div class="mb-4 grid grid-cols-1 gap-3.5 sm:grid-cols-2 xl:grid-cols-4">
            <KpiCard
              label="Total Produk & Stok Fisik"
              value={
                <>
                  {products()
                    .reduce((total, product) => total + totalStock(product), 0)
                    .toLocaleString("id-ID")}{" "}
                  <span class="text-xs font-semibold text-muted">
                    unit / {products().length} SKU
                  </span>
                </>
              }
              color="#2563EB"
              icon={<Boxes size={16} />}
              footer={
                <>
                  <span>
                    WH-BACK:{" "}
                    <b class="text-ink">
                      {products().reduce(
                        (total, product) => total + product.warehouseStock,
                        0,
                      )}
                    </b>
                  </span>
                  <span>
                    STORE-FRONT:{" "}
                    <b class="text-ink">
                      {products().reduce(
                        (total, product) => total + product.storeStock,
                        0,
                      )}
                    </b>
                  </span>
                </>
              }
            />
            <KpiCard
              label="Valuasi Persediaan (HPP)"
              value={formatRupiah(inventoryValue(products()))}
              color="#16A34A"
              icon={<Wallet size={16} />}
              footer={
                <>
                  Nilai jual eceran:{" "}
                  <b class="text-ink">
                    {formatRupiah(retailValue(products()))}
                  </b>
                </>
              }
            />
            <KpiCard
              label="Penjualan & Laba Kotor"
              value={formatRupiah(kpis().revenue)}
              color="#1D4ED8"
              icon={<TrendingUp size={16} />}
              footer={
                <>
                  <span class="font-bold text-success">
                    {formatRupiah(kpis().grossProfit)}
                  </span>
                  <span>({formatPercent(kpis().margin)})</span>
                </>
              }
            />
            <KpiCard
              label="Peringatan Stok"
              value={
                <>
                  <span class="text-amber-500">{lowStock().length}</span>{" "}
                  <span class="text-xs text-muted">menipis</span>{" "}
                  <span class="text-danger">{outOfStock()}</span>{" "}
                  <span class="text-xs text-muted">habis</span>
                </>
              }
              color="#F59E0B"
              icon={<AlertTriangle size={16} />}
              footer={
                <Show
                  when={canSeePurchasing()}
                  fallback={
                    <>
                      Stok habis: <b class="text-danger">{outOfStock()} SKU</b>
                    </>
                  }
                >
                  Hutang supplier:{" "}
                  <b class="text-danger">{formatRupiah(payablesTotal())}</b>
                </Show>
              }
            />
          </div>

          <div class="mb-4 grid gap-4 xl:grid-cols-[2fr_1fr]">
            <Card>
              <CardHeader
                title="Tren Penjualan vs HPP & Laba Kotor"
                subtitle="Moving Weighted Average Cost — periode terpilih"
                actions={
                  <div class="hidden items-center gap-3.5 text-[11px] text-muted sm:flex">
                    <span class="flex items-center gap-1.5">
                      <i class="inline-block size-[9px] rounded-[2px] bg-blue" />
                      Penjualan
                    </span>
                    <span class="flex items-center gap-1.5">
                      <i class="inline-block size-[9px] rounded-[2px] bg-slate-300" />
                      HPP
                    </span>
                    <span class="flex items-center gap-1.5">
                      <i class="inline-block h-[3px] w-4 bg-success" />
                      Laba
                    </span>
                  </div>
                }
              />
              <CardBody>
                <SalesChart points={chartPoints()} />
              </CardBody>
            </Card>

            <Card>
              <CardHeader title="Valuasi Stok per Lokasi" />
              <CardBody>
                <StockDonut slices={valuation()} />
              </CardBody>
            </Card>
          </div>

          <div class="mb-4 grid gap-4 xl:grid-cols-2">
            <Card>
              <CardHeader
                title={`Stok Menipis & Habis (${lowStock().length})`}
                actions={
                  <A href="/products">
                    <Button size="sm">Lihat Semua &rarr;</Button>
                  </A>
                }
              />
              <Show
                when={lowStock().length > 0}
                fallback={
                  <EmptyState
                    title="Semua stok aman"
                    description="Tidak ada produk di bawah ambang minimum."
                  />
                }
              >
                <div class="max-h-[260px] overflow-auto">
                  <table class="w-full min-w-[520px] border-collapse text-[12.5px]">
                    <thead>
                      <tr>
                        <th class="border-b border-line bg-slate-50 px-3 py-2.5 text-left text-[10.5px] font-extrabold tracking-[.05em] text-muted uppercase">
                          Produk
                        </th>
                        <th class="border-b border-line bg-slate-50 px-3 py-2.5 text-center text-[10.5px] font-extrabold tracking-[.05em] text-muted uppercase">
                          WH-BACK
                        </th>
                        <th class="border-b border-line bg-slate-50 px-3 py-2.5 text-center text-[10.5px] font-extrabold tracking-[.05em] text-muted uppercase">
                          STORE-FRONT
                        </th>
                        <th class="border-b border-line bg-slate-50 px-3 py-2.5 text-center text-[10.5px] font-extrabold tracking-[.05em] text-muted uppercase">
                          Status
                        </th>
                        <th class="border-b border-line bg-slate-50 px-3 py-2.5" />
                      </tr>
                    </thead>
                    <tbody>
                      <For each={lowStock()}>
                        {(product) => {
                          const status = () => stockStatus(product);
                          return (
                            <tr class="hover:bg-slate-50">
                              <td class="border-b border-slate-100 px-3 py-2.5">
                                <b class="text-ink">{product.name}</b>
                                <div class="text-[11px] text-faint">
                                  {product.sku}
                                </div>
                              </td>
                              <td class="border-b border-slate-100 px-3 py-2.5 text-center">
                                {product.warehouseStock}
                              </td>
                              <td
                                class={`border-b border-slate-100 px-3 py-2.5 text-center font-bold ${
                                  product.storeStock <= product.minStoreStock
                                    ? "text-danger"
                                    : ""
                                }`}
                              >
                                {product.storeStock}
                              </td>
                              <td class="border-b border-slate-100 px-3 py-2.5 text-center">
                                <Pill
                                  tone={status() === "HABIS" ? "red" : "amber"}
                                >
                                  {status()}
                                </Pill>
                              </td>
                              <td class="border-b border-slate-100 px-3 py-2.5 text-center">
                                <Button
                                  size="sm"
                                  onClick={() =>
                                    navigate(
                                      lowStockTarget(
                                        product.warehouseStock > 0,
                                      ),
                                    )
                                  }
                                >
                                  {product.warehouseStock > 0 &&
                                  product.storeStock <= product.minStoreStock
                                    ? "Mutasi"
                                    : "Buat PO"}
                                </Button>
                              </td>
                            </tr>
                          );
                        }}
                      </For>
                    </tbody>
                  </table>
                </div>
              </Show>
            </Card>

            <Show when={canSeePurchasing() || canSeeWarehouse()}>
              <Card>
                <CardHeader
                  title="Jatuh Tempo & Mutasi Pending"
                  actions={
                    <Show when={canSeePurchasing()}>
                      <A href="/soon/purchasing">
                        <Button size="sm">Kelola &rarr;</Button>
                      </A>
                    </Show>
                  }
                />
                <div class="max-h-[260px] overflow-y-auto">
                  <Show when={canSeePurchasing()}>
                    <For each={payables()}>
                      {(payable) => (
                        <div class="flex items-center justify-between gap-2 border-b border-slate-100 px-[18px] py-2.5">
                          <div class="min-w-0">
                            <b class="block truncate text-[12.5px] text-ink">
                              {payable.supplierName}
                            </b>
                            <div class="text-[11px] text-faint">
                              Faktur {payable.invoice} &bull; tempo{" "}
                              <b class="text-danger">
                                {formatDate(payable.due)}
                              </b>
                            </div>
                          </div>
                          <div class="shrink-0 text-right">
                            <b class="block text-[12.5px] text-danger">
                              {formatRupiah(payable.total - payable.paid)}
                            </b>
                            <Pill
                              tone={
                                payable.status === "PARTIAL" ? "amber" : "red"
                              }
                            >
                              {payable.status === "PARTIAL"
                                ? "Cicilan"
                                : "Belum Bayar"}
                            </Pill>
                          </div>
                        </div>
                      )}
                    </For>
                  </Show>
                  <Show when={canSeeWarehouse()}>
                    <For each={pendingTransfers()}>
                      {(transfer) => (
                        <div class="flex items-center justify-between gap-2 border-b border-slate-100 bg-blue-50/40 px-[18px] py-2.5">
                          <div class="min-w-0">
                            <b class="block truncate text-[12.5px] text-royal">
                              Mutasi {transfer.number}
                            </b>
                            <div class="text-[11px] text-faint">
                              {transfer.createdBy} &bull; {transfer.itemCount}{" "}
                              jenis barang
                            </div>
                          </div>
                          <A href="/soon/warehouse">
                            <Button size="sm">Selesaikan</Button>
                          </A>
                        </div>
                      )}
                    </For>
                  </Show>
                  <Show
                    when={
                      (canSeePurchasing() ? payables().length : 0) +
                        (canSeeWarehouse() ? pendingTransfers().length : 0) ===
                      0
                    }
                  >
                    <EmptyState
                      title="Tidak ada tagihan atau mutasi tertunda"
                      description="Semua kewajiban supplier dan mutasi stok sudah selesai."
                    />
                  </Show>
                </div>
              </Card>
            </Show>
          </div>

          <Card>
            <CardHeader
              title="Transaksi POS Terbaru"
              subtitle="Tersinkron dari Desktop POS"
              actions={
                <Show when={canSeeSales()}>
                  <A href="/soon/sales">
                    <Button size="sm">Semua Penjualan &rarr;</Button>
                  </A>
                </Show>
              }
            />
            <Show
              when={recentSales().length > 0}
              fallback={
                <EmptyState
                  title="Belum ada transaksi"
                  description="Transaksi POS yang tersinkron akan muncul di sini."
                  icon={<ClipboardList size={36} stroke-width={1.6} />}
                />
              }
            >
              <div class="overflow-x-auto">
                <table class="w-full min-w-[760px] border-collapse text-[12.5px]">
                  <thead>
                    <tr>
                      <For
                        each={[
                          "No. Struk",
                          "Waktu",
                          "Kasir",
                          "Metode",
                          "Total",
                          "Status",
                          "",
                        ]}
                      >
                        {(heading, index) => (
                          <th
                            class={`border-b border-line bg-slate-50 px-3 py-2.5 text-[10.5px] font-extrabold tracking-[.05em] text-muted uppercase ${
                              index() === 4 ? "text-right" : "text-left"
                            }`}
                          >
                            {heading}
                          </th>
                        )}
                      </For>
                    </tr>
                  </thead>
                  <tbody>
                    <For each={recentSales()}>
                      {(sale) => (
                        <tr class="hover:bg-slate-50">
                          <td class="border-b border-slate-100 px-3 py-2.5 font-mono text-[11px]">
                            {sale.number}
                          </td>
                          <td class="border-b border-slate-100 px-3 py-2.5">
                            {formatDateTime(sale.time)}
                          </td>
                          <td class="border-b border-slate-100 px-3 py-2.5">
                            {sale.cashier}
                          </td>
                          <td class="border-b border-slate-100 px-3 py-2.5">
                            <Pill tone={methodTone(sale.method)}>
                              {sale.method}
                            </Pill>
                          </td>
                          <td class="border-b border-slate-100 px-3 py-2.5 text-right font-bold tabular-nums">
                            {formatRupiah(saleTotals(sale).grandTotal)}
                          </td>
                          <td class="border-b border-slate-100 px-3 py-2.5">
                            <Pill
                              tone={
                                sale.status === "COMPLETED" ? "green" : "amber"
                              }
                            >
                              {sale.status === "COMPLETED"
                                ? "SELESAI"
                                : "RETUR SEBAGIAN"}
                            </Pill>
                          </td>
                          <td class="border-b border-slate-100 px-3 py-2.5 text-center">
                            <Button size="sm" onClick={() => setDetail(sale)}>
                              Detail
                            </Button>
                          </td>
                        </tr>
                      )}
                    </For>
                  </tbody>
                </table>
              </div>
            </Show>
          </Card>
        </Show>
      </Show>

      <Modal
        open={detail() !== null}
        onOpenChange={(open) => {
          if (!open) setDetail(null);
        }}
        title={`Detail Struk ${detail()?.number ?? ""}`}
        footer={<Button onClick={() => setDetail(null)}>Tutup</Button>}
      >
        <Show when={detail()}>
          {(sale) => {
            const totals = () => saleTotals(sale());
            return (
              <div class="space-y-4">
                <div class="grid grid-cols-2 gap-3 text-xs sm:grid-cols-4">
                  <div>
                    <div class="text-faint">Waktu</div>
                    <b>{formatDateTime(sale().time)}</b>
                  </div>
                  <div>
                    <div class="text-faint">Kasir</div>
                    <b>{sale().cashier}</b>
                  </div>
                  <div>
                    <div class="text-faint">Metode</div>
                    <b>{sale().method}</b>
                  </div>
                  <div>
                    <div class="text-faint">Terminal</div>
                    <b>{sale().terminal}</b>
                  </div>
                </div>
                <div class="overflow-x-auto">
                  <table class="w-full min-w-[520px] border-collapse text-xs">
                    <thead>
                      <tr>
                        <th class="border-b border-line bg-slate-50 px-2 py-2 text-left text-[10px] font-extrabold tracking-wide text-muted uppercase">
                          Produk
                        </th>
                        <th class="border-b border-line bg-slate-50 px-2 py-2 text-center text-[10px] font-extrabold tracking-wide text-muted uppercase">
                          Qty
                        </th>
                        <th class="border-b border-line bg-slate-50 px-2 py-2 text-right text-[10px] font-extrabold tracking-wide text-muted uppercase">
                          Harga
                        </th>
                        <th class="border-b border-line bg-slate-50 px-2 py-2 text-right text-[10px] font-extrabold tracking-wide text-muted uppercase">
                          Retur
                        </th>
                        <th class="border-b border-line bg-slate-50 px-2 py-2 text-right text-[10px] font-extrabold tracking-wide text-muted uppercase">
                          Jumlah
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      <For each={sale().items}>
                        {(item) => (
                          <tr>
                            <td class="border-b border-slate-100 px-2 py-2">
                              <b>{item.name}</b>
                              <div class="text-[10px] text-faint">
                                per {item.unit}
                              </div>
                            </td>
                            <td class="border-b border-slate-100 px-2 py-2 text-center">
                              {item.quantity}
                            </td>
                            <td class="border-b border-slate-100 px-2 py-2 text-right tabular-nums">
                              {formatRupiah(item.price)}
                            </td>
                            <td class="border-b border-slate-100 px-2 py-2 text-right">
                              {item.returned || "-"}
                            </td>
                            <td class="border-b border-slate-100 px-2 py-2 text-right font-bold tabular-nums">
                              {formatRupiah(
                                (item.quantity - item.returned) * item.price,
                              )}
                            </td>
                          </tr>
                        )}
                      </For>
                    </tbody>
                  </table>
                </div>
                <div class="ml-auto max-w-xs space-y-1.5 text-xs">
                  <div class="flex justify-between">
                    <span class="text-muted">Subtotal</span>
                    <span>{formatRupiah(totals().subtotal)}</span>
                  </div>
                  <div class="flex justify-between">
                    <span class="text-muted">Diskon</span>
                    <span>-{formatRupiah(totals().discount)}</span>
                  </div>
                  <div class="flex justify-between border-t border-line pt-1.5 text-sm font-extrabold">
                    <span>Total</span>
                    <span>{formatRupiah(totals().grandTotal)}</span>
                  </div>
                  <div class="flex justify-between">
                    <span class="text-muted">Diterima</span>
                    <span>{formatRupiah(sale().received)}</span>
                  </div>
                </div>
              </div>
            );
          }}
        </Show>
      </Modal>
    </>
  );
}
