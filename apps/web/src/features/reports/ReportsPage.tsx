import { createQuery } from "@tanstack/solid-query";
import {
  Badge,
  Button,
  EmptyState,
  ErrorState,
  PageHeader,
  Panel,
  PanelBody,
  PanelHeader,
  SegmentedControl,
  Table,
  TableSkeleton,
  TableWrap,
  Td,
  Th,
  useToast,
} from "@tokojojo/ui";
import { Download, FileText, Printer } from "lucide-solid";
import { createMemo, createSignal, For, Show } from "solid-js";

import { useAuth } from "../../app/auth";
import { repository } from "../../data/repository";
import {
  type DateRange,
  recordsInRange,
  salesInRange,
  salesKpis,
  saleTotals,
  totalStock,
} from "../../lib/calc";
import { formatDate, formatPercent, formatRupiah } from "../../lib/format";
import { downloadCsv } from "../products/productCsv";
import {
  buildPrintHtml,
  buildReportCsv,
  escapeHtml,
  printReport,
  type ReportMeta,
} from "./reportCsv";
import {
  type ReportCategory,
  type ReportDefinition,
  reportDefinitions,
} from "./reportDefinitions";

type PreviewTable = {
  header: string[];
  rows: Array<Array<string | number>>;
};

export function ReportsPage() {
  const auth = useAuth();
  const toast = useToast();
  const [category, setCategory] = createSignal<ReportCategory>("PENJUALAN");
  const [range, setRange] = createSignal<DateRange>("MONTH");
  const [selectedTitle, setSelectedTitle] = createSignal(
    reportDefinitions[0]!.title,
  );

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
  const movementsQuery = createQuery(() => ({
    queryKey: ["movements"],
    queryFn: () => repository.listMovements(),
  }));
  const cashFlowsQuery = createQuery(() => ({
    queryKey: ["cashFlows"],
    queryFn: () => repository.listCashFlows(),
  }));
  const settingsQuery = createQuery(() => ({
    queryKey: ["settings"],
    queryFn: () => repository.getSettings(),
  }));

  const loading = () =>
    productsQuery.isPending ||
    salesQuery.isPending ||
    payablesQuery.isPending ||
    movementsQuery.isPending ||
    cashFlowsQuery.isPending ||
    settingsQuery.isPending;
  const failed = () =>
    productsQuery.isError ||
    salesQuery.isError ||
    payablesQuery.isError ||
    movementsQuery.isError ||
    cashFlowsQuery.isError ||
    settingsQuery.isError;

  const reports = createMemo(() =>
    reportDefinitions.filter((report) => report.category === category()),
  );
  const selected = createMemo<ReportDefinition>(
    () =>
      reports().find((report) => report.title === selectedTitle()) ??
      reports()[0]!,
  );
  const filteredSales = createMemo(() =>
    salesInRange(salesQuery.data ?? [], range()).filter(
      (sale) => sale.status !== "VOIDED",
    ),
  );
  const filteredMovements = createMemo(() =>
    recordsInRange(
      movementsQuery.data ?? [],
      (movement) => movement.time,
      range(),
    ),
  );
  const filteredCashFlows = createMemo(() =>
    recordsInRange(cashFlowsQuery.data ?? [], (flow) => flow.time, range()),
  );

  const preview = createMemo<PreviewTable>(() => {
    const report = selected();

    if (report.kind === "SALES") {
      return {
        header: ["Invoice", "Tanggal", "Kasir", "Metode", "Total", "Laba"],
        rows: filteredSales().map((sale) => {
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

    if (report.kind === "PRODUCTS") {
      const buckets = new Map<string, { qty: number; revenue: number }>();
      for (const sale of filteredSales()) {
        for (const item of sale.items) {
          const sold = Math.max(0, item.quantity - item.returned);
          const current = buckets.get(item.name) ?? { qty: 0, revenue: 0 };
          current.qty += sold;
          current.revenue += sold * item.price;
          buckets.set(item.name, current);
        }
      }
      return {
        header: ["Produk", "Terjual", "Omzet"],
        rows: [...buckets.entries()]
          .sort((a, b) => b[1].revenue - a[1].revenue)
          .map(([name, value]) => [
            name,
            value.qty,
            formatRupiah(value.revenue),
          ]),
      };
    }

    if (report.kind === "CASHIER") {
      const buckets = new Map<string, { count: number; revenue: number }>();
      for (const sale of filteredSales()) {
        const current = buckets.get(sale.cashier) ?? { count: 0, revenue: 0 };
        current.count += 1;
        current.revenue += saleTotals(sale).grandTotal;
        buckets.set(sale.cashier, current);
      }
      return {
        header: ["Kasir", "Transaksi", "Omzet"],
        rows: [...buckets.entries()].map(([name, value]) => [
          name,
          value.count,
          formatRupiah(value.revenue),
        ]),
      };
    }

    if (report.kind === "STOCK") {
      return {
        header: ["Produk", "SKU", "Gudang", "Toko", "Total", "Nilai HPP"],
        rows: (productsQuery.data ?? []).map((product) => [
          product.name,
          product.sku,
          product.warehouseStock,
          product.storeStock,
          totalStock(product),
          formatRupiah(totalStock(product) * product.cost),
        ]),
      };
    }

    if (report.kind === "PAYABLES") {
      return {
        header: ["Supplier", "Faktur", "Jatuh tempo", "Total", "Sisa"],
        rows: (payablesQuery.data ?? []).map((payable) => [
          payable.supplierName,
          payable.invoice,
          formatDate(payable.due),
          formatRupiah(payable.total),
          formatRupiah(payable.total - payable.paid),
        ]),
      };
    }

    if (report.kind === "MOVEMENT") {
      return {
        header: ["Tanggal", "Produk", "Lokasi", "Tipe", "Qty", "Referensi"],
        rows: filteredMovements().map((movement) => [
          formatDate(movement.time),
          movement.productName,
          movement.location,
          movement.type,
          movement.quantity,
          movement.reference,
        ]),
      };
    }

    if (report.kind === "CASHFLOW") {
      return {
        header: ["Tanggal", "Tipe", "Kategori", "Nominal", "Sumber"],
        rows: filteredCashFlows().map((flow) => [
          formatDate(flow.time),
          flow.type,
          flow.category,
          formatRupiah(flow.amount),
          flow.source,
        ]),
      };
    }

    if (report.kind === "PROFIT") {
      const kpis = salesKpis(filteredSales());
      return {
        header: ["Komponen", "Nilai"],
        rows: [
          ["Penjualan Bersih", formatRupiah(kpis.revenue)],
          ["HPP", formatRupiah(kpis.cogs)],
          ["Laba Kotor", formatRupiah(kpis.grossProfit)],
          ["Margin", formatPercent(kpis.margin)],
        ],
      };
    }

    return {
      header: ["Keterangan"],
      rows: [
        [
          "Laporan ini tersedia sebagai mock. Data lengkap akan mengikuti API laporan.",
        ],
      ],
    };
  });

  const meta = (): ReportMeta => ({
    storeName: settingsQuery.data?.name ?? "TOKO JOJO",
    userName: auth.user()?.name ?? "Pengguna",
    generatedAt: new Date(),
  });

  const exportCsv = () => {
    const table = preview();
    const csv = buildReportCsv(selected().title, meta(), [
      table.header,
      ...table.rows,
    ]);
    downloadCsv(
      `${selected()
        .title.toLowerCase()
        .replaceAll(/[^a-z0-9]+/g, "-")}.csv`,
      csv,
    );
    toast.notify(`Ekspor CSV: ${selected().title}`);
  };

  const print = () => {
    const table = preview();
    const body = `<table style="width:100%;border-collapse:collapse;font-size:12px">
      <thead><tr>${table.header
        .map(
          (heading) =>
            `<th style="text-align:left;padding:6px;border-bottom:1px solid #e4e4e7">${escapeHtml(heading)}</th>`,
        )
        .join("")}</tr></thead>
      <tbody>${table.rows
        .map(
          (row) =>
            `<tr>${row
              .map(
                (cell) =>
                  `<td style="padding:6px;border-bottom:1px solid #f1f2f4">${escapeHtml(String(cell))}</td>`,
              )
              .join("")}</tr>`,
        )
        .join("")}</tbody>
    </table>`;
    printReport(
      buildPrintHtml({
        ...meta(),
        title: selected().title,
        bodyHtml: body,
      }),
    );
  };

  return (
    <>
      <PageHeader
        eyebrow="Laporan penjualan, persediaan, dan keuangan"
        title="Laporan"
        subtitle="Pratinjau, ekspor CSV, dan cetak laporan."
        actions={
          <>
            <Button size="sm" onClick={exportCsv}>
              <Download size={14} /> CSV
            </Button>
            <Button size="sm" variant="primary" onClick={print}>
              <Printer size={14} /> Cetak
            </Button>
          </>
        }
      />

      <div class="mb-3 flex flex-wrap items-center justify-between gap-3">
        <SegmentedControl
          value={category()}
          onChange={setCategory}
          items={[
            { value: "PENJUALAN", label: "Penjualan" },
            { value: "PERSEDIAAN", label: "Persediaan" },
            { value: "KEUANGAN", label: "Keuangan" },
          ]}
          label="Kategori laporan"
        />
        <Show
          when={selected().usesRange}
          fallback={
            <span class="text-xs text-ink-muted">
              Rentang tidak berlaku untuk laporan ini.
            </span>
          }
        >
          <SegmentedControl
            value={range()}
            onChange={setRange}
            items={[
              { value: "TODAY", label: "Hari Ini" },
              { value: "7DAYS", label: "7 Hari" },
              { value: "MONTH", label: "Bulan Ini" },
              { value: "ALL", label: "Semua" },
            ]}
            label="Rentang laporan"
          />
        </Show>
      </div>

      <Show
        when={!failed()}
        fallback={
          <Panel>
            <ErrorState
              message="Laporan tidak dapat dimuat."
              onRetry={() => {
                void productsQuery.refetch();
                void salesQuery.refetch();
                void payablesQuery.refetch();
                void movementsQuery.refetch();
                void cashFlowsQuery.refetch();
                void settingsQuery.refetch();
              }}
            />
          </Panel>
        }
      >
        <div class="grid grid-cols-1 gap-3 xl:grid-cols-[320px_1fr]">
          <div class="space-y-2">
            <For each={reports()}>
              {(report) => (
                <button
                  type="button"
                  onClick={() => setSelectedTitle(report.title)}
                  class={`w-full cursor-pointer rounded-[8px] border p-3 text-left transition-colors ${
                    selected().title === report.title
                      ? "border-primary bg-primary-soft"
                      : "border-line bg-surface hover:bg-hover"
                  }`}
                >
                  <div class="flex items-start gap-2">
                    <FileText size={16} class="mt-0.5 text-primary" />
                    <div>
                      <div class="text-sm font-bold text-ink">
                        {report.title}
                      </div>
                      <div class="mt-0.5 text-xs text-ink-muted">
                        {report.description}
                      </div>
                    </div>
                  </div>
                </button>
              )}
            </For>
          </div>

          <Panel>
            <PanelHeader
              title={selected().title}
              description={selected().description}
              actions={<Badge tone="info">{preview().rows.length} baris</Badge>}
            />
            <PanelBody>
              <Show
                when={!loading()}
                fallback={<TableSkeleton rows={8} cols={5} />}
              >
                <Show
                  when={preview().rows.length > 0}
                  fallback={
                    <EmptyState
                      title="Tidak ada data pada periode ini"
                      description="Ubah rentang atau pilih laporan lain."
                    />
                  }
                >
                  <TableWrap>
                    <Table>
                      <thead>
                        <tr>
                          <For each={preview().header}>
                            {(heading) => <Th>{heading}</Th>}
                          </For>
                        </tr>
                      </thead>
                      <tbody>
                        <For each={preview().rows}>
                          {(row) => (
                            <tr class="hover:bg-hover">
                              <For each={row}>{(cell) => <Td>{cell}</Td>}</For>
                            </tr>
                          )}
                        </For>
                      </tbody>
                    </Table>
                  </TableWrap>
                </Show>
              </Show>
            </PanelBody>
          </Panel>
        </div>
      </Show>

      <div id="print-area" />
    </>
  );
}
