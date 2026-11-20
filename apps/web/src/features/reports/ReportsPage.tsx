import { createQuery } from "@tanstack/solid-query";
import { Download, FileSpreadsheet, FileText, Printer } from "lucide-solid";
import { For, Show } from "solid-js";

import { useAuth } from "../../app/auth";
import { useToast } from "../../app/toast";
import { Button } from "../../components/ui/Button";
import { Card } from "../../components/ui/Card";
import { ErrorState } from "../../components/ui/ErrorState";
import { PageHeader } from "../../components/ui/PageHeader";
import { Skeleton } from "../../components/ui/Skeleton";
import { repository } from "../../data/repository";
import type { Payable, Product, Sale } from "../../data/types";
import { salesKpis, saleTotals, totalStock } from "../../lib/calc";
import { formatDate, formatPercent, formatRupiah } from "../../lib/format";
import { downloadCsv } from "../products/productCsv";
import {
  buildPrintHtml,
  buildReportCsv,
  escapeHtml,
  printReport,
  type ReportMeta,
} from "./reportCsv";

type ReportKind =
  | "SALES"
  | "SALES_PRODUCT"
  | "SALES_CASHIER"
  | "PURCHASES"
  | "PAYABLES"
  | "STOCK"
  | "MOVEMENT"
  | "OPNAME"
  | "PROFIT"
  | "CASHFLOW";

type ReportDefinition = {
  title: string;
  description: string;
  code: string;
  color: string;
  kind: ReportKind;
};

const reports: ReportDefinition[] = [
  {
    title: "Penjualan Harian / Mingguan / Bulanan",
    description: "Ringkasan omzet, HPP, laba per periode",
    code: "PJ",
    color: "#2563EB",
    kind: "SALES",
  },
  {
    title: "Penjualan per Produk / Kategori",
    description: "Produk terlaris & kontribusi margin",
    code: "PP",
    color: "#059669",
    kind: "SALES_PRODUCT",
  },
  {
    title: "Penjualan per Kasir / Metode",
    description: "Kinerja kasir & pemakaian QRIS/Tunai/Debit",
    code: "PK",
    color: "#7C3AED",
    kind: "SALES_CASHIER",
  },
  {
    title: "Riwayat & Biaya Pembelian",
    description: "Pembelian per supplier & tren HPP",
    code: "PB",
    color: "#D97706",
    kind: "PURCHASES",
  },
  {
    title: "Hutang Supplier Jatuh Tempo",
    description: "Aging & rencana pembayaran",
    code: "HS",
    color: "#DC2626",
    kind: "PAYABLES",
  },
  {
    title: "Ikhtisar & Valuasi Stok",
    description: "Stok per lokasi dengan nilai HPP",
    code: "VS",
    color: "#0891B2",
    kind: "STOCK",
  },
  {
    title: "Pergerakan Stok (Ledger)",
    description: "Kartu stok masuk-keluar per produk",
    code: "LG",
    color: "#65A30D",
    kind: "MOVEMENT",
  },
  {
    title: "Selisih Stock Opname",
    description: "Rekapitulasi selisih fisik vs sistem",
    code: "SO",
    color: "#B45309",
    kind: "OPNAME",
  },
  {
    title: "Laba Rugi (P&L)",
    description: "Penjualan − HPP − beban operasional",
    code: "LR",
    color: "#16A34A",
    kind: "PROFIT",
  },
  {
    title: "Arus Kas",
    description: "Kas masuk-keluar per akun",
    code: "AK",
    color: "#0F766E",
    kind: "CASHFLOW",
  },
];

type ReportTable = {
  header: string[];
  rows: Array<Array<string | number>>;
};

function salesReport(sales: Sale[]): ReportTable {
  return {
    header: ["No. Struk", "Waktu", "Kasir", "Metode", "Total", "Laba"],
    rows: sales.map((sale) => {
      const totals = saleTotals(sale);
      return [
        sale.number,
        formatDate(sale.time),
        sale.cashier,
        sale.method,
        formatRupiah(totals.grandTotal),
        formatRupiah(totals.grandTotal - totals.cogs),
      ];
    }),
  };
}

function productReport(sales: Sale[]): ReportTable {
  const buckets = new Map<
    string,
    { quantity: number; revenue: number; profit: number }
  >();

  for (const sale of sales) {
    for (const item of sale.items) {
      const sold = Math.max(0, item.quantity - item.returned);
      const current = buckets.get(item.name) ?? {
        quantity: 0,
        revenue: 0,
        profit: 0,
      };
      current.quantity += sold;
      current.revenue += sold * (item.price - item.discount);
      current.profit += sold * (item.price - item.discount - item.cost);
      buckets.set(item.name, current);
    }
  }

  return {
    header: ["Produk", "Terjual", "Omzet", "Laba Kotor"],
    rows: [...buckets.entries()]
      .sort((a, b) => b[1].revenue - a[1].revenue)
      .map(([name, value]) => [
        name,
        value.quantity,
        formatRupiah(value.revenue),
        formatRupiah(value.profit),
      ]),
  };
}

function cashierReport(sales: Sale[]): ReportTable {
  const buckets = new Map<
    string,
    { count: number; revenue: number; profit: number }
  >();

  for (const sale of sales) {
    const totals = saleTotals(sale);
    const current = buckets.get(sale.cashier) ?? {
      count: 0,
      revenue: 0,
      profit: 0,
    };
    current.count += 1;
    current.revenue += totals.grandTotal;
    current.profit += totals.grandTotal - totals.cogs;
    buckets.set(sale.cashier, current);
  }

  return {
    header: ["Kasir", "Transaksi", "Omzet", "Laba Kotor"],
    rows: [...buckets.entries()]
      .sort((a, b) => b[1].revenue - a[1].revenue)
      .map(([name, value]) => [
        name,
        value.count,
        formatRupiah(value.revenue),
        formatRupiah(value.profit),
      ]),
  };
}

function payableReport(payables: Payable[], aging: boolean): ReportTable {
  return {
    header: aging
      ? [
          "Faktur",
          "Supplier",
          "Jatuh Tempo",
          "Total",
          "Terbayar",
          "Sisa",
          "Status",
        ]
      : ["Faktur", "Supplier", "Jatuh Tempo", "Total", "Terbayar", "Sisa"],
    rows: payables.map((payable) => {
      const base = [
        payable.invoice,
        payable.supplierName,
        formatDate(payable.due),
        formatRupiah(payable.total),
        formatRupiah(payable.paid),
        formatRupiah(payable.total - payable.paid),
      ];
      return aging
        ? [...base, payable.status === "PARTIAL" ? "Cicilan" : "Belum Bayar"]
        : base;
    }),
  };
}

function stockReport(products: Product[]): ReportTable {
  return {
    header: ["Produk", "SKU", "Gudang", "Toko", "Total", "HPP", "Nilai HPP"],
    rows: products.map((product) => [
      product.name,
      product.sku,
      product.warehouseStock,
      product.storeStock,
      totalStock(product),
      formatRupiah(product.cost),
      formatRupiah(totalStock(product) * product.cost),
    ]),
  };
}

function noteReport(note: string): ReportTable {
  return {
    header: ["Keterangan"],
    rows: [[note]],
  };
}

export function ReportsPage() {
  const auth = useAuth();
  const toast = useToast();

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
  const settingsQuery = createQuery(() => ({
    queryKey: ["settings"],
    queryFn: () => repository.getSettings(),
  }));

  const products = () => productsQuery.data ?? [];
  const sales = () => salesQuery.data ?? [];
  const payables = () => payablesQuery.data ?? [];
  const loading = () =>
    productsQuery.isPending || salesQuery.isPending || payablesQuery.isPending;
  const failed = () =>
    productsQuery.isError || salesQuery.isError || payablesQuery.isError;

  const meta = (): ReportMeta => ({
    storeName: settingsQuery.data?.name ?? "TOKO JOJO",
    userName: auth.user()?.name ?? "Pengguna",
    generatedAt: new Date(),
  });

  const tableFor = (kind: ReportKind): ReportTable => {
    switch (kind) {
      case "SALES":
        return salesReport(sales());
      case "SALES_PRODUCT":
        return productReport(sales());
      case "SALES_CASHIER":
        return cashierReport(sales());
      case "PURCHASES":
        return payableReport(payables(), false);
      case "PAYABLES":
        return payableReport(payables(), true);
      case "STOCK":
        return stockReport(products());
      case "MOVEMENT":
        return noteReport(
          "Buku besar pergerakan stok akan tersedia setelah API tersambung. Data contoh hanya memuat stok akhir per lokasi.",
        );
      case "OPNAME":
        return noteReport(
          "Sesi stock opname belum tersedia pada data contoh. Modul opname akan aktif bersama API persediaan.",
        );
      case "PROFIT": {
        const kpis = salesKpis(sales());
        return {
          header: ["Komponen", "Nilai"],
          rows: [
            ["Penjualan Bersih", formatRupiah(kpis.revenue)],
            ["HPP (Moving Weighted Average)", formatRupiah(kpis.cogs)],
            ["Laba Kotor", formatRupiah(kpis.grossProfit)],
            ["Margin Kotor", formatPercent(kpis.margin)],
          ],
        };
      }
      case "CASHFLOW":
        return noteReport(
          "Rekap kas dan bank memerlukan modul Keuangan. Data contoh belum memuat saldo akun.",
        );
    }
  };

  const exportCsv = (report: ReportDefinition) => {
    const table = tableFor(report.kind);
    const csv = buildReportCsv(report.title, meta(), [
      table.header,
      ...table.rows,
    ]);
    const slug = report.title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "");
    downloadCsv(`${slug || "laporan"}.csv`, csv);
    toast.notify(`Ekspor CSV: ${report.title}`);
  };

  const print = (report: ReportDefinition) => {
    const table = tableFor(report.kind);
    const body = `<table style="width:100%;border-collapse:collapse;font-size:12px">
      <thead><tr>${table.header
        .map(
          (heading) =>
            `<th style="text-align:left;padding:6px;border-bottom:1px solid #e2e8f0">${escapeHtml(heading)}</th>`,
        )
        .join("")}</tr></thead>
      <tbody>${table.rows
        .map(
          (row) =>
            `<tr>${row
              .map(
                (cell) =>
                  `<td style="padding:6px;border-bottom:1px solid #f1f5f9">${escapeHtml(String(cell))}</td>`,
              )
              .join("")}</tr>`,
        )
        .join("")}</tbody>
    </table>`;

    printReport(
      buildPrintHtml({
        ...meta(),
        title: report.title,
        bodyHtml: body,
      }),
    );
  };

  const retry = () => {
    void productsQuery.refetch();
    void salesQuery.refetch();
    void payablesQuery.refetch();
  };

  return (
    <>
      <PageHeader
        eyebrow="Cetak, ekspor, dan arsipkan laporan operasional"
        title="Pusat Laporan"
        subtitle="Laporan memakai data contoh hingga API laporan tersedia"
      />

      <Show
        when={!failed()}
        fallback={
          <Card>
            <ErrorState
              message="Data laporan tidak dapat dimuat."
              onRetry={retry}
            />
          </Card>
        }
      >
        <Show
          when={!loading()}
          fallback={
            <div class="grid gap-3.5 [grid-template-columns:repeat(auto-fill,minmax(280px,1fr))]">
              <For each={reports}>
                {() => (
                  <Card class="p-4">
                    <Skeleton class="h-10 w-10" />
                    <Skeleton class="mt-3 h-4 w-3/4" />
                    <Skeleton class="mt-2 h-3 w-full" />
                    <Skeleton class="mt-4 h-8 w-full" />
                  </Card>
                )}
              </For>
            </div>
          }
        >
          <div class="mb-4 rounded-[10px] border border-blue-200 bg-blue-50 px-4 py-2.5 text-xs text-royal">
            <b>Catatan:</b> tombol PDF membuka dialog cetak browser. Tombol
            Excel menunggu ekspor server; CSV sudah berfungsi penuh dengan data
            contoh.
          </div>

          <div class="grid gap-3.5 [grid-template-columns:repeat(auto-fill,minmax(280px,1fr))]">
            <For each={reports}>
              {(report) => (
                <Card class="px-[18px] py-4">
                  <div class="flex items-start gap-3">
                    <span
                      class="flex size-[38px] shrink-0 items-center justify-center rounded-lg text-xs font-bold"
                      style={{
                        background: `${report.color}16`,
                        color: report.color,
                      }}
                    >
                      {report.code}
                    </span>
                    <div class="min-w-0 flex-1">
                      <b class="text-[13.5px] text-ink">{report.title}</b>
                      <div class="mt-0.5 text-xs text-muted">
                        {report.description}
                      </div>
                      <div class="mt-3 flex flex-wrap gap-1.5">
                        <Button size="sm" onClick={() => print(report)}>
                          <Printer size={12} /> PDF
                        </Button>
                        <Button
                          size="sm"
                          onClick={() =>
                            toast.notify(
                              "Ekspor Excel tersedia setelah API laporan tersambung.",
                              "warn",
                            )
                          }
                        >
                          <FileSpreadsheet size={12} /> Excel
                        </Button>
                        <Button size="sm" onClick={() => exportCsv(report)}>
                          <Download size={12} /> CSV
                        </Button>
                      </div>
                    </div>
                  </div>
                </Card>
              )}
            </For>
          </div>

          <Card class="mt-4">
            <div class="flex items-start gap-3 px-[18px] py-4">
              <span class="flex size-9 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-muted">
                <FileText size={16} />
              </span>
              <div class="text-xs text-muted">
                <b class="text-ink">Format cetak</b>
                <p class="mt-0.5">
                  Setiap laporan dicetak dengan nama toko, judul laporan, waktu
                  cetak, dan nama pengguna aktif. Gunakan orientasi potret;
                  tabel lebar otomatis menyesuaikan.
                </p>
              </div>
            </div>
          </Card>
        </Show>
      </Show>

      <div id="print-area" />
    </>
  );
}
