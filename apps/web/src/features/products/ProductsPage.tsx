import { useLocation } from "@solidjs/router";
import { createQuery, useQueryClient } from "@tanstack/solid-query";
import { Download, PackagePlus, Pencil, Search, Upload } from "lucide-solid";
import {
  createEffect,
  createMemo,
  createSignal,
  For,
  on,
  Show,
} from "solid-js";

import { useAuth } from "../../app/auth";
import { useToast } from "../../app/toast";
import { Button } from "../../components/ui/Button";
import { Card, CardHeader } from "../../components/ui/Card";
import { EmptyState } from "../../components/ui/EmptyState";
import { ErrorState } from "../../components/ui/ErrorState";
import { PageHeader } from "../../components/ui/PageHeader";
import { Pill } from "../../components/ui/Pill";
import { TableSkeleton } from "../../components/ui/Skeleton";
import { repository } from "../../data/repository";
import type { Product } from "../../data/types";
import { stockStatus, totalStock } from "../../lib/calc";
import { formatRupiah } from "../../lib/format";
import { downloadCsv, productsToCsv } from "./productCsv";
import { ProductFormModal } from "./ProductFormModal";

function productInitials(name: string): string {
  return name
    .split(" ")
    .map((word) => word[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

export function ProductsPage() {
  const auth = useAuth();
  const toast = useToast();
  const location = useLocation();
  const queryClient = useQueryClient();

  const initialQuery =
    typeof location.query.q === "string" ? location.query.q : "";

  const [query, setQuery] = createSignal(initialQuery);
  const [category, setCategory] = createSignal("Semua");
  const [brand, setBrand] = createSignal("Semua");
  const [editing, setEditing] = createSignal<{
    product: Product | null;
  } | null>(null);

  createEffect(
    on(
      () => location.query.q,
      (value) => {
        if (typeof value === "string") {
          setQuery(value);
        }
      },
    ),
  );

  const productsQuery = createQuery(() => ({
    queryKey: ["products"],
    queryFn: () => repository.listProducts(),
  }));

  const products = () => productsQuery.data ?? [];
  const categories = createMemo(() => [
    "Semua",
    ...new Set(products().map((product) => product.category)),
  ]);
  const brands = createMemo(() => [
    "Semua",
    ...new Set(products().map((product) => product.brand)),
  ]);

  const filtered = createMemo(() => {
    const needle = query().trim().toLowerCase();
    return products().filter((product) => {
      const matchesQuery =
        !needle ||
        product.name.toLowerCase().includes(needle) ||
        product.sku.toLowerCase().includes(needle) ||
        product.barcode.toLowerCase().includes(needle);
      const matchesCategory =
        category() === "Semua" || product.category === category();
      const matchesBrand = brand() === "Semua" || product.brand === brand();
      return matchesQuery && matchesCategory && matchesBrand;
    });
  });

  const canEdit = () =>
    auth.user()?.role === "OWNER" || auth.user()?.role === "ADMIN";

  const exportCsv = () => {
    downloadCsv(
      `produk-tokojojo-${new Date().toISOString().slice(0, 10)}.csv`,
      productsToCsv(filtered()),
    );
    toast.notify(`Ekspor CSV: ${filtered().length} produk diunduh`);
  };

  const onSaved = () => {
    void queryClient.invalidateQueries({ queryKey: ["products"] });
  };

  return (
    <>
      <PageHeader
        eyebrow="Katalog barang — multi-barcode, HPP, harga jual"
        title={`Master Produk (${products().length} SKU)`}
        actions={
          <Show
            when={canEdit()}
            fallback={
              <Pill tone="gray">Mode lihat — peran {auth.user()?.role}</Pill>
            }
          >
            <Button
              variant="primary"
              size="sm"
              onClick={() => setEditing({ product: null })}
            >
              <PackagePlus size={14} /> Tambah Produk
            </Button>
          </Show>
        }
      />

      <Card>
        <CardHeader
          title={`Menampilkan ${filtered().length} dari ${products().length} produk`}
          subtitle="Cari berdasarkan nama, SKU, atau barcode. Filter kategori dan merek."
          actions={
            <div class="flex flex-wrap items-center gap-2">
              <div class="relative">
                <Search
                  size={14}
                  class="pointer-events-none absolute top-1/2 left-2.5 -translate-y-1/2 text-faint"
                />
                <input
                  class="h-9 w-[220px] max-w-full rounded-lg border-[1.5px] border-line bg-white pr-2.5 pl-8 text-[13px] outline-none transition focus:border-royal"
                  placeholder="Cari nama / SKU / barcode..."
                  value={query()}
                  onInput={(event) => setQuery(event.currentTarget.value)}
                />
              </div>
              <select
                aria-label="Filter kategori"
                class="h-9 rounded-lg border-[1.5px] border-line bg-white px-2.5 text-[13px] outline-none focus:border-royal"
                value={category()}
                onChange={(event) => setCategory(event.currentTarget.value)}
              >
                <For each={categories()}>
                  {(item) => <option value={item}>{item}</option>}
                </For>
              </select>
              <select
                aria-label="Filter merek"
                class="h-9 rounded-lg border-[1.5px] border-line bg-white px-2.5 text-[13px] outline-none focus:border-royal"
                value={brand()}
                onChange={(event) => setBrand(event.currentTarget.value)}
              >
                <For each={brands()}>
                  {(item) => <option value={item}>{item}</option>}
                </For>
              </select>
              <Button size="sm" onClick={exportCsv}>
                <Download size={13} /> CSV
              </Button>
              <Button
                size="sm"
                onClick={() =>
                  toast.notify(
                    "Fitur impor massal tersedia setelah API tersambung.",
                    "warn",
                  )
                }
              >
                <Upload size={13} /> Impor
              </Button>
            </div>
          }
        />

        <Show
          when={!productsQuery.isError}
          fallback={
            <ErrorState
              message="Katalog produk tidak dapat dimuat."
              onRetry={() => void productsQuery.refetch()}
            />
          }
        >
          <Show
            when={!productsQuery.isPending}
            fallback={<TableSkeleton rows={8} cols={6} />}
          >
            <div class="overflow-x-auto">
              <table class="w-full min-w-[940px] border-collapse text-[12.5px]">
                <thead>
                  <tr>
                    <For
                      each={[
                        { label: "Produk", align: "left" },
                        { label: "SKU / Barcode", align: "left" },
                        { label: "Kategori", align: "left" },
                        { label: "HPP", align: "right" },
                        { label: "Harga Jual", align: "right" },
                        { label: "Stok Total", align: "center" },
                        { label: "Status", align: "center" },
                        { label: "", align: "center" },
                      ]}
                    >
                      {(column) => (
                        <th
                          class={`border-b border-line bg-slate-50 px-3 py-2.5 text-[10.5px] font-extrabold tracking-[.05em] whitespace-nowrap text-muted uppercase ${
                            column.align === "right"
                              ? "text-right"
                              : column.align === "center"
                                ? "text-center"
                                : "text-left"
                          }`}
                        >
                          {column.label}
                        </th>
                      )}
                    </For>
                  </tr>
                </thead>
                <tbody>
                  <Show
                    when={filtered().length > 0}
                    fallback={
                      <tr>
                        <td colspan="8">
                          <EmptyState
                            title="Tidak ada produk cocok"
                            description="Ubah kata kunci atau filter kategori/merek."
                          />
                        </td>
                      </tr>
                    }
                  >
                    <For each={filtered()}>
                      {(product) => {
                        const status = () => stockStatus(product);
                        return (
                          <tr class="hover:bg-slate-50">
                            <td class="border-b border-slate-100 px-3 py-2.5">
                              <div class="flex items-center gap-2.5">
                                <span
                                  class="flex size-[34px] shrink-0 items-center justify-center rounded-lg text-[11px] font-bold"
                                  style={{
                                    background: `${product.color}18`,
                                    color: product.color,
                                  }}
                                >
                                  {productInitials(product.name)}
                                </span>
                                <div class="min-w-0">
                                  <b class="block max-w-[300px] truncate text-ink">
                                    {product.name}
                                  </b>
                                  <div class="text-[11px] text-faint">
                                    {product.brand} &bull; per {product.unit}
                                  </div>
                                </div>
                              </div>
                            </td>
                            <td class="border-b border-slate-100 px-3 py-2.5">
                              <div class="font-mono text-[11px]">
                                {product.sku}
                              </div>
                              <div class="font-mono text-[10px] text-faint">
                                {product.barcode}
                              </div>
                            </td>
                            <td class="border-b border-slate-100 px-3 py-2.5">
                              {product.category}
                            </td>
                            <td class="border-b border-slate-100 px-3 py-2.5 text-right tabular-nums">
                              {formatRupiah(product.cost)}
                            </td>
                            <td class="border-b border-slate-100 px-3 py-2.5 text-right font-bold tabular-nums">
                              {formatRupiah(product.price)}
                            </td>
                            <td class="border-b border-slate-100 px-3 py-2.5 text-center">
                              <b>{totalStock(product)}</b>{" "}
                              <span class="text-[10.5px] text-faint">
                                {product.unit}
                              </span>
                            </td>
                            <td class="border-b border-slate-100 px-3 py-2.5 text-center">
                              <Pill
                                tone={
                                  status() === "HABIS"
                                    ? "red"
                                    : status() === "MENIPIS"
                                      ? "amber"
                                      : "green"
                                }
                              >
                                {status()}
                              </Pill>
                            </td>
                            <td class="border-b border-slate-100 px-3 py-2.5 text-center">
                              <Button
                                size="sm"
                                onClick={() => setEditing({ product })}
                              >
                                <Pencil size={12} />
                                {canEdit() ? "Edit" : "Lihat"}
                              </Button>
                            </td>
                          </tr>
                        );
                      }}
                    </For>
                  </Show>
                </tbody>
              </table>
            </div>
          </Show>
        </Show>
      </Card>

      <Show when={editing()}>
        {(entry) => (
          <ProductFormModal
            product={entry().product}
            categories={categories().filter((item) => item !== "Semua")}
            canEdit={canEdit()}
            onClose={() => setEditing(null)}
            onSaved={onSaved}
          />
        )}
      </Show>
    </>
  );
}
