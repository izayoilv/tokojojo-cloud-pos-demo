import { createQuery } from "@tanstack/solid-query";
import {
  Badge,
  EmptyState,
  ErrorState,
  PageHeader,
  Panel,
  SearchInput,
  Select,
  Table,
  TableSkeleton,
  TableWrap,
  Tabs,
  Td,
  Th,
} from "@tokojojo/ui";
import { createMemo, createSignal, For, Show } from "solid-js";

import { repository } from "../../data/repository";
import { stockStatus, totalStock } from "../../lib/calc";
import { formatDate, formatRupiah } from "../../lib/format";

type InventoryTab = "STOK" | "MUTASI";

const movementLabels: Record<string, string> = {
  PURCHASE: "Pembelian",
  PURCHASE_CANCEL: "Batal beli",
  SALE: "Penjualan",
  TRANSFER_OUT: "Mutasi keluar",
  TRANSFER_IN: "Mutasi masuk",
  OPNAME: "Opname",
  RETURN: "Retur",
  SALE_VOID: "Void",
  ADJUSTMENT: "Penyesuaian",
};

export function InventoryPage() {
  const [tab, setTab] = createSignal<InventoryTab>("STOK");
  const [search, setSearch] = createSignal("");
  const [location, setLocation] = createSignal("SEMUA");
  const [type, setType] = createSignal("SEMUA");

  const productsQuery = createQuery(() => ({
    queryKey: ["products"],
    queryFn: () => repository.listProducts(),
  }));
  const movementsQuery = createQuery(() => ({
    queryKey: ["movements"],
    queryFn: () => repository.listMovements(),
  }));

  const products = createMemo(() => {
    const needle = search().trim().toLowerCase();
    return (productsQuery.data ?? []).filter(
      (product) =>
        !needle ||
        product.name.toLowerCase().includes(needle) ||
        product.sku.toLowerCase().includes(needle),
    );
  });

  const movements = createMemo(() => {
    const needle = search().trim().toLowerCase();
    return (movementsQuery.data ?? []).filter((movement) => {
      const matchesSearch =
        !needle ||
        movement.productName.toLowerCase().includes(needle) ||
        movement.reference.toLowerCase().includes(needle);
      const matchesLocation =
        location() === "SEMUA" ||
        (location() === "WH-BACK" && movement.location === "WH-BACK") ||
        (location() === "STORE-FRONT" && movement.location === "STORE-FRONT");
      const matchesType = type() === "SEMUA" || movement.type === type();
      return matchesSearch && matchesLocation && matchesType;
    });
  });

  const loading = () => productsQuery.isPending || movementsQuery.isPending;
  const failed = () => productsQuery.isError || movementsQuery.isError;

  return (
    <>
      <PageHeader
        eyebrow="Stok per lokasi dan buku besar pergerakan"
        title="Persediaan"
        subtitle="Stok berasal dari ledger; koreksi hanya melalui opname atau penyesuaian."
        actions={
          <Select
            value={location()}
            onChange={(event) => setLocation(event.currentTarget.value)}
            aria-label="Filter lokasi"
            class="w-44"
          >
            <option value="SEMUA">Semua lokasi</option>
            <option value="WH-BACK">Gudang belakang</option>
            <option value="STORE-FRONT">Area toko</option>
          </Select>
        }
      />

      <Tabs
        value={tab()}
        onChange={setTab}
        items={[
          { value: "STOK", label: "Stok", count: products().length },
          { value: "MUTASI", label: "Mutasi", count: movements().length },
        ]}
        label="Tampilan persediaan"
        class="mb-3"
      />

      <Show
        when={!failed()}
        fallback={
          <Panel>
            <ErrorState
              message="Data persediaan tidak dapat dimuat."
              onRetry={() => {
                void productsQuery.refetch();
                void movementsQuery.refetch();
              }}
            />
          </Panel>
        }
      >
        <Show
          when={!loading()}
          fallback={
            <Panel>
              <TableSkeleton rows={8} cols={6} />
            </Panel>
          }
        >
          <Panel>
            <div class="border-b border-line p-4">
              <div class="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_220px]">
                <SearchInput
                  placeholder="Cari produk, SKU, atau referensi..."
                  value={search()}
                  onInput={(event) => setSearch(event.currentTarget.value)}
                />
                <Show when={tab() === "MUTASI"}>
                  <Select
                    value={type()}
                    onChange={(event) => setType(event.currentTarget.value)}
                    aria-label="Filter tipe pergerakan"
                  >
                    <option value="SEMUA">Semua tipe</option>
                    <For each={Object.entries(movementLabels)}>
                      {([value, label]) => (
                        <option value={value}>{label}</option>
                      )}
                    </For>
                  </Select>
                </Show>
              </div>
            </div>

            <Show
              when={tab() === "STOK"}
              fallback={
                <Show
                  when={movements().length > 0}
                  fallback={
                    <EmptyState
                      title="Belum ada pergerakan stok"
                      description="Pergerakan muncul setelah pembelian, mutasi, penjualan, atau opname."
                    />
                  }
                >
                  <TableWrap>
                    <Table class="min-w-[960px]">
                      <thead>
                        <tr>
                          <Th>Tanggal</Th>
                          <Th>Produk</Th>
                          <Th>Lokasi</Th>
                          <Th>Tipe</Th>
                          <Th align="right">Qty</Th>
                          <Th>Referensi</Th>
                          <Th>Oleh</Th>
                        </tr>
                      </thead>
                      <tbody>
                        <For each={movements()}>
                          {(movement) => (
                            <tr class="hover:bg-hover">
                              <Td>{formatDate(movement.time)}</Td>
                              <Td>
                                <b class="text-ink">{movement.productName}</b>
                                <div class="text-xs text-ink-muted">
                                  {movement.note}
                                </div>
                              </Td>
                              <Td>
                                <Badge
                                  tone={
                                    movement.location === "WH-BACK"
                                      ? "neutral"
                                      : "info"
                                  }
                                >
                                  {movement.location}
                                </Badge>
                              </Td>
                              <Td>{movementLabels[movement.type]}</Td>
                              <Td
                                align="right"
                                class={
                                  movement.quantity < 0
                                    ? "font-bold text-danger"
                                    : "font-bold text-success"
                                }
                              >
                                {movement.quantity > 0 ? "+" : ""}
                                {movement.quantity}
                              </Td>
                              <Td class="font-mono text-[11px]">
                                {movement.reference}
                              </Td>
                              <Td>{movement.createdBy}</Td>
                            </tr>
                          )}
                        </For>
                      </tbody>
                    </Table>
                  </TableWrap>
                </Show>
              }
            >
              <Show
                when={products().length > 0}
                fallback={
                  <EmptyState
                    title="Tidak ada produk"
                    description="Tambahkan produk terlebih dahulu."
                  />
                }
              >
                <TableWrap>
                  <Table class="min-w-[880px]">
                    <thead>
                      <tr>
                        <Th>SKU</Th>
                        <Th>Produk</Th>
                        <Th align="right">Gudang</Th>
                        <Th align="right">Toko</Th>
                        <Th align="right">Total</Th>
                        <Th align="right">Minimum</Th>
                        <Th>Status</Th>
                        <Th align="right">Nilai HPP</Th>
                      </tr>
                    </thead>
                    <tbody>
                      <For each={products()}>
                        {(product) => (
                          <tr class="hover:bg-hover">
                            <Td class="font-mono text-[11px]">{product.sku}</Td>
                            <Td>
                              <b class="text-ink">{product.name}</b>
                              <div class="text-xs text-ink-muted">
                                {product.category}
                              </div>
                            </Td>
                            <Td align="right">{product.warehouseStock}</Td>
                            <Td align="right">{product.storeStock}</Td>
                            <Td align="right">
                              <b>{totalStock(product)}</b>
                            </Td>
                            <Td align="right">{product.minStock}</Td>
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
                                {stockStatus(product) === "HABIS"
                                  ? "Habis"
                                  : stockStatus(product) === "MENIPIS"
                                    ? "Menipis"
                                    : "Aman"}
                              </Badge>
                            </Td>
                            <Td align="right">
                              {formatRupiah(totalStock(product) * product.cost)}
                            </Td>
                          </tr>
                        )}
                      </For>
                    </tbody>
                  </Table>
                </TableWrap>
              </Show>
            </Show>
          </Panel>
        </Show>
      </Show>
    </>
  );
}
