import { useLocation } from "@solidjs/router";
import { createQuery, useQueryClient } from "@tanstack/solid-query";
import {
  Badge,
  Button,
  Checkbox,
  EmptyState,
  ErrorState,
  PageHeader,
  Pagination,
  Panel,
  SearchInput,
  Select,
  Table,
  TableSkeleton,
  TableWrap,
  Td,
  Th,
  useToast,
} from "@tokojojo/ui";
import { Download, PackagePlus, Pencil } from "lucide-solid";
import {
  createEffect,
  createMemo,
  createSignal,
  For,
  on,
  Show,
} from "solid-js";

import { useAuth } from "../../app/auth";
import { repository } from "../../data/repository";
import type { Product } from "../../data/types";
import { baseUnit, productUnits, stockStatus } from "../../lib/calc";
import { formatRupiah } from "../../lib/format";
import { downloadCsv, productsToCsv } from "./productCsv";
import { ProductFormModal } from "./ProductFormModal";

const statusLabel = {
  AMAN: "Aman",
  MENIPIS: "Menipis",
  HABIS: "Habis",
} as const;

export function ProductsPage() {
  const auth = useAuth();
  const toast = useToast();
  const location = useLocation();
  const queryClient = useQueryClient();
  const queryParam = () =>
    typeof location.query.q === "string" ? location.query.q : "";

  const [search, setSearch] = createSignal(queryParam());
  const [category, setCategory] = createSignal("Semua");
  const [status, setStatus] = createSignal("SEMUA");
  const [locationFilter, setLocationFilter] = createSignal("SEMUA");
  const [page, setPage] = createSignal(1);
  const [selected, setSelected] = createSignal<string[]>([]);
  const [editing, setEditing] = createSignal<{
    product: Product | null;
  } | null>(null);

  createEffect(
    on(queryParam, (value) => {
      setSearch(value);
      setPage(1);
    }),
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
  const canEdit = () =>
    auth.user()?.role === "OWNER" || auth.user()?.role === "ADMIN";

  const filtered = createMemo(() => {
    const needle = search().trim().toLowerCase();
    return products().filter((product) => {
      const matchesSearch =
        !needle ||
        product.name.toLowerCase().includes(needle) ||
        product.sku.toLowerCase().includes(needle) ||
        product.barcode.includes(needle) ||
        productUnits(product).some((unit) => unit.barcode.includes(needle));
      const matchesCategory =
        category() === "Semua" || product.category === category();
      const matchesStatus =
        status() === "SEMUA" || stockStatus(product) === status();
      const matchesLocation =
        locationFilter() === "SEMUA" ||
        (locationFilter() === "GUDANG" && product.warehouseStock > 0) ||
        (locationFilter() === "TOKO" && product.storeStock > 0);
      return (
        matchesSearch && matchesCategory && matchesStatus && matchesLocation
      );
    });
  });

  const pageSize = 8;
  const paged = createMemo(() =>
    filtered().slice((page() - 1) * pageSize, page() * pageSize),
  );
  const allSelected = () =>
    paged().length > 0 && paged().every((p) => selected().includes(p.id));

  const toggleAll = (checked: boolean) => {
    setSelected((current) =>
      checked
        ? [...new Set([...current, ...paged().map((p) => p.id)])]
        : current.filter((id) => !paged().some((p) => p.id === id)),
    );
  };

  const reset = () => {
    setSearch("");
    setCategory("Semua");
    setStatus("SEMUA");
    setLocationFilter("SEMUA");
    setPage(1);
  };

  const exportCsv = () => {
    downloadCsv(
      `produk-tokojojo-${new Date().toISOString().slice(0, 10)}.csv`,
      productsToCsv(filtered()),
    );
    toast.notify(`Ekspor CSV: ${filtered().length} produk diunduh.`);
  };

  const archiveSelected = async () => {
    if (selected().length === 0) return;
    await Promise.all(
      selected().map((id) => repository.setProductActive(id, false)),
    );
    setSelected([]);
    await queryClient.invalidateQueries({ queryKey: ["products"] });
    toast.notify("Produk terpilih diarsipkan.", "warning");
  };

  return (
    <>
      <PageHeader
        eyebrow="Katalog barang — multi-satuan, HPP, harga jual"
        title={`Master Produk (${products().length} SKU)`}
        subtitle="Satuan dasar ditampilkan; produk multi-satuan menampilkan jumlah satuan."
        actions={
          <>
            <Button size="sm" onClick={exportCsv}>
              <Download size={14} /> Ekspor CSV
            </Button>
            <Show when={canEdit()}>
              <Button
                size="sm"
                variant="primary"
                onClick={() => setEditing({ product: null })}
              >
                <PackagePlus size={14} /> Tambah Produk
              </Button>
            </Show>
          </>
        }
      />

      <Panel>
        <div class="border-b border-line p-4">
          <div class="grid grid-cols-1 items-end gap-3 sm:grid-cols-2 xl:grid-cols-[1.5fr_1fr_1fr_1fr_auto]">
            <div class="flex flex-col gap-1.5">
              <span class="text-xs font-semibold text-ink-secondary">Cari</span>
              <SearchInput
                placeholder="Nama, SKU, barcode"
                value={search()}
                onInput={(event) => {
                  setSearch(event.currentTarget.value);
                  setPage(1);
                }}
              />
            </div>
            <div class="flex flex-col gap-1.5">
              <span class="text-xs font-semibold text-ink-secondary">
                Kategori
              </span>
              <Select
                value={category()}
                onChange={(event) => {
                  setCategory(event.currentTarget.value);
                  setPage(1);
                }}
              >
                <For each={categories()}>
                  {(item) => <option>{item}</option>}
                </For>
              </Select>
            </div>
            <div class="flex flex-col gap-1.5">
              <span class="text-xs font-semibold text-ink-secondary">
                Status
              </span>
              <Select
                value={status()}
                onChange={(event) => {
                  setStatus(event.currentTarget.value);
                  setPage(1);
                }}
              >
                <option value="SEMUA">Semua</option>
                <option value="AMAN">Aman</option>
                <option value="MENIPIS">Menipis</option>
                <option value="HABIS">Habis</option>
              </Select>
            </div>
            <div class="flex flex-col gap-1.5">
              <span class="text-xs font-semibold text-ink-secondary">
                Lokasi
              </span>
              <Select
                value={locationFilter()}
                onChange={(event) => {
                  setLocationFilter(event.currentTarget.value);
                  setPage(1);
                }}
              >
                <option value="SEMUA">Semua</option>
                <option value="GUDANG">Gudang belakang</option>
                <option value="TOKO">Area toko</option>
              </Select>
            </div>
            <Button size="sm" variant="ghost" onClick={reset}>
              Reset
            </Button>
          </div>
          <Show when={selected().length > 0 && canEdit()}>
            <div class="mt-3 flex items-center gap-2 rounded-[6px] bg-primary-soft px-3 py-2 text-sm text-primary">
              <b>{selected().length} produk dipilih</b>
              <Button
                size="sm"
                variant="soft-danger"
                class="ml-auto"
                onClick={() => void archiveSelected()}
              >
                Arsipkan
              </Button>
            </div>
          </Show>
        </div>

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
            <Show
              when={paged().length > 0}
              fallback={
                <EmptyState
                  title="Tidak ada produk cocok"
                  description="Ubah kata kunci atau filter produk."
                  action={
                    <Button size="sm" onClick={reset}>
                      Reset filter
                    </Button>
                  }
                />
              }
            >
              <TableWrap>
                <Table class="min-w-[1120px]">
                  <thead>
                    <tr>
                      <Th class="w-10">
                        <Checkbox
                          label="Pilih semua"
                          showLabel={false}
                          checked={allSelected()}
                          onChange={toggleAll}
                        />
                      </Th>
                      <Th>SKU</Th>
                      <Th>Produk</Th>
                      <Th>Kategori</Th>
                      <Th>Satuan</Th>
                      <Th align="right">HPP</Th>
                      <Th align="right">Harga</Th>
                      <Th align="right">Gudang</Th>
                      <Th align="right">Toko</Th>
                      <Th>Status</Th>
                      <Th align="center">Aksi</Th>
                    </tr>
                  </thead>
                  <tbody>
                    <For each={paged()}>
                      {(product) => (
                        <tr class="hover:bg-hover">
                          <Td>
                            <Checkbox
                              label={`Pilih ${product.name}`}
                              showLabel={false}
                              checked={selected().includes(product.id)}
                              onChange={(checked) =>
                                setSelected((current) =>
                                  checked
                                    ? [...current, product.id]
                                    : current.filter((id) => id !== product.id),
                                )
                              }
                            />
                          </Td>
                          <Td class="font-mono text-[11px] whitespace-nowrap">
                            {product.sku}
                          </Td>
                          <Td>
                            <b class="block max-w-[260px] truncate text-ink">
                              {product.name}
                            </b>
                            <span class="font-mono text-[11px] text-ink-muted">
                              {product.barcode}
                            </span>
                          </Td>
                          <Td>{product.category}</Td>
                          <Td>
                            {baseUnit(product).name}
                            <Show when={productUnits(product).length > 1}>
                              <Badge tone="neutral" class="ml-1">
                                {productUnits(product).length} satuan
                              </Badge>
                            </Show>
                          </Td>
                          <Td align="right">{formatRupiah(product.cost)}</Td>
                          <Td align="right">
                            <b>{formatRupiah(product.price)}</b>
                          </Td>
                          <Td align="right">{product.warehouseStock}</Td>
                          <Td align="right">{product.storeStock}</Td>
                          <Td>
                            <Badge
                              tone={
                                stockStatus(product) === "HABIS"
                                  ? "danger"
                                  : stockStatus(product) === "MENIPIS"
                                    ? "warning"
                                    : "success"
                              }
                            >
                              {statusLabel[stockStatus(product)]}
                            </Badge>
                          </Td>
                          <Td align="center">
                            <Button
                              size="sm"
                              onClick={() => setEditing({ product })}
                            >
                              <Pencil size={13} />
                              {canEdit() ? "Edit" : "Lihat"}
                            </Button>
                          </Td>
                        </tr>
                      )}
                    </For>
                  </tbody>
                </Table>
              </TableWrap>
              <Pagination
                page={page()}
                pageSize={pageSize}
                total={filtered().length}
                onPage={setPage}
              />
            </Show>
          </Show>
        </Show>
      </Panel>

      <Show when={editing()}>
        {(entry) => (
          <ProductFormModal
            product={entry().product}
            canEdit={canEdit()}
            onClose={() => setEditing(null)}
            onSaved={() => {
              void queryClient.invalidateQueries({ queryKey: ["products"] });
            }}
          />
        )}
      </Show>
    </>
  );
}
