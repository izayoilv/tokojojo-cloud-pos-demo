import { Button, EmptyState, Modal } from "@tokojojo/ui";
import {
  CreditCard,
  History,
  ListRestart,
  PackageOpen,
  Pause,
  ScanBarcode,
  Search,
  ShoppingCart,
  Trash2,
  X,
} from "lucide-solid";
import { createMemo, createSignal, For, Show } from "solid-js";

import { usePos } from "../app/PosProvider";
import { useShortcuts } from "../app/useShortcuts";
import { CartLineItem } from "../components/CartLine";
import { ProductTile } from "../components/ProductTile";
import { UnitPicker } from "../components/UnitPicker";
import type { PosProduct } from "../data/types";
import { formatTime } from "../lib/format";
import { cartTotals, filterProducts, formatRupiah } from "../lib/posCalc";

export function SellScreen() {
  const pos = usePos();
  const [query, setQuery] = createSignal("");
  const [category, setCategory] = createSignal("Semua");
  const [unitProduct, setUnitProduct] = createSignal<PosProduct | null>(null);
  const [recallOpen, setRecallOpen] = createSignal(false);

  let searchRef: HTMLInputElement | undefined;

  const filtered = createMemo(() =>
    filterProducts(pos.state.products, query(), category()),
  );

  const emptyCart = () => pos.state.cart().length === 0;
  const heldCount = () => pos.state.heldCarts().length;

  const selectProduct = (product: PosProduct) => {
    if (product.units.length > 1) {
      setUnitProduct(product);
      return;
    }

    const unit = product.units[0];
    if (unit) {
      pos.actions.addProduct(product.id, unit.id);
    }
  };

  const submitSearch = () => {
    const value = query().trim();
    if (!value) return;

    const lower = value.toLowerCase();
    const byBarcode = pos.state.products.find(
      (product) =>
        product.barcode.toLowerCase() === lower ||
        product.units.some((unit) => unit.barcode.toLowerCase() === lower),
    );

    if (byBarcode) {
      const unit =
        byBarcode.units.find((item) => item.barcode.toLowerCase() === lower) ??
        byBarcode.units[0];
      if (unit) {
        pos.actions.addProduct(byBarcode.id, unit.id);
      }
      setQuery("");
      return;
    }

    const results = filtered();
    if (results.length === 1) {
      selectProduct(results[0]);
      setQuery("");
    }
  };

  useShortcuts({
    F3: () => {
      searchRef?.focus();
      searchRef?.select();
    },
    F8: () => pos.actions.holdCart(),
    Escape: () => {
      if (query()) setQuery("");
    },
  });

  return (
    <div class="flex h-full min-h-0">
      <section class="flex min-w-0 flex-1 flex-col bg-canvas">
        <div class="shrink-0 border-b border-line bg-surface px-3 py-2.5">
          <div class="flex items-center gap-2">
            <div class="relative min-w-0 flex-1">
              <Search
                size={16}
                class="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-ink-muted"
              />
              <input
                ref={searchRef}
                type="search"
                aria-label="Cari produk"
                placeholder="Pindai barcode atau cari nama / SKU…"
                value={query()}
                onInput={(event) => setQuery(event.currentTarget.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    submitSearch();
                  }
                }}
                autofocus
                class="h-11 w-full rounded-[6px] border border-line-control bg-surface pr-24 pl-9 text-sm text-ink outline-none transition placeholder:text-ink-muted focus:border-primary focus:ring-2 focus:ring-primary/20"
              />
              <Show when={query()}>
                <button
                  type="button"
                  aria-label="Bersihkan pencarian"
                  onClick={() => setQuery("")}
                  class="absolute top-1/2 right-9 flex size-11 -translate-y-1/2 cursor-pointer items-center justify-center rounded-full bg-subtle text-ink-muted hover:text-ink"
                >
                  <X size={12} />
                </button>
              </Show>
              <kbd class="pointer-events-none absolute top-1/2 right-2.5 -translate-y-1/2 rounded-[3px] border border-line bg-subtle px-1 py-0.5 font-mono text-[0.5625rem] font-bold text-ink-muted">
                F3
              </kbd>
            </div>

            <button
              type="button"
              onClick={() => {
                searchRef?.focus();
                searchRef?.select();
              }}
              title="Fokus ke kolom pindai (demo)"
              class="flex h-11 shrink-0 cursor-pointer items-center gap-1.5 rounded-[6px] border border-line-control bg-surface px-3 text-xs font-bold text-ink-secondary transition-colors hover:bg-hover hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
            >
              <ScanBarcode size={16} /> Pindai
            </button>
          </div>

          <div class="mt-1.5 flex flex-wrap items-center gap-1">
            <For each={pos.state.categories()}>
              {(item) => (
                <button
                  type="button"
                  aria-pressed={category() === item}
                  onClick={() => setCategory(item)}
                  class={`h-11 cursor-pointer rounded-full border px-3 text-[0.625rem] font-bold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus ${
                    category() === item
                      ? "border-primary bg-primary text-on-primary"
                      : "border-line bg-surface text-ink-secondary hover:bg-hover hover:text-ink"
                  }`}
                >
                  {item}
                </button>
              )}
            </For>
            <span class="ml-auto text-[0.625rem] font-semibold text-ink-muted">
              {filtered().length} produk
            </span>
          </div>
        </div>

        <Show when={pos.state.error()}>
          <div
            role="alert"
            class="shrink-0 border-b border-danger/20 bg-danger-soft px-3 py-1.5 text-[0.6875rem] font-bold text-danger"
          >
            {pos.state.error()}
          </div>
        </Show>

        <div class="min-h-0 flex-1 overflow-y-auto p-3">
          <Show
            when={filtered().length > 0}
            fallback={
              <EmptyState
                icon={<Search size={36} stroke-width={1.6} />}
                title="Produk tidak ditemukan"
                description="Coba kata kunci lain, pindai barcode, atau pilih kategori Semua."
                action={
                  <Button
                    size="sm"
                    onClick={() => {
                      setQuery("");
                      setCategory("Semua");
                    }}
                  >
                    Reset pencarian
                  </Button>
                }
              />
            }
          >
            <div class="grid auto-rows-fr grid-cols-3 gap-2 xl:grid-cols-4">
              <For each={filtered()}>
                {(product) => (
                  <ProductTile
                    product={product}
                    onSelect={() => selectProduct(product)}
                  />
                )}
              </For>
            </div>
          </Show>
        </div>
      </section>

      <aside class="flex w-[400px] shrink-0 flex-col border-l border-line bg-surface">
        <div class="flex h-12 shrink-0 items-center gap-2 border-b border-line px-3">
          <h2 class="text-sm font-extrabold text-ink">Transaksi Aktif</h2>
          <span class="rounded-full bg-subtle px-1.5 py-0.5 text-[0.625rem] font-bold text-ink-secondary">
            {pos.state.totals().itemCount} item
          </span>
          <button
            type="button"
            aria-label="Kosongkan keranjang"
            title="Kosongkan keranjang"
            disabled={emptyCart()}
            onClick={() => pos.actions.clearCart()}
            class="ml-auto flex size-11 cursor-pointer items-center justify-center rounded-[4px] text-ink-muted transition-colors hover:bg-danger-soft hover:text-danger focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent disabled:hover:text-ink-muted"
          >
            <Trash2 size={15} />
          </button>
        </div>

        <div class="min-h-0 flex-1 overflow-y-auto">
          <Show
            when={!emptyCart()}
            fallback={
              <EmptyState
                class="py-8"
                icon={<ShoppingCart size={34} stroke-width={1.6} />}
                title="Keranjang kosong"
                description="Pilih produk dari katalog untuk mulai transaksi."
              />
            }
          >
            <For each={pos.state.cart()}>
              {(line) => (
                <CartLineItem
                  line={line}
                  onQuantity={(quantity) =>
                    pos.actions.setQuantity(line.id, quantity)
                  }
                  onRemove={() => pos.actions.removeLine(line.id)}
                />
              )}
            </For>
          </Show>
        </div>

        <div class="shrink-0 border-t border-line bg-subtle px-3 py-2.5">
          <div class="flex justify-between gap-2 text-[0.6875rem] font-semibold text-ink-secondary">
            <span>Subtotal ({pos.state.totals().itemCount} item)</span>
            <span class="font-mono tabular-nums">
              {formatRupiah(pos.state.totals().subtotal)}
            </span>
          </div>
          <div class="mt-0.5 flex justify-between gap-2 text-[0.6875rem] font-semibold text-ink-secondary">
            <span>Diskon</span>
            <span class="font-mono tabular-nums">
              {pos.state.totals().discount > 0
                ? `-${formatRupiah(pos.state.totals().discount)}`
                : "—"}
            </span>
          </div>
          <div class="mt-1.5 flex items-baseline justify-between gap-2 border-t border-line-strong pt-1.5">
            <span class="text-xs font-extrabold text-ink">Total</span>
            <span class="font-mono text-2xl font-extrabold text-ink tabular-nums">
              {formatRupiah(pos.state.totals().total)}
            </span>
          </div>

          <Button
            variant="primary"
            size="lg"
            full
            class="mt-2"
            disabled={emptyCart()}
            onClick={() => pos.actions.go("PAYMENT")}
          >
            <CreditCard size={17} /> Bayar
            <kbd class="ml-1 rounded-[3px] bg-on-primary/15 px-1 py-0.5 font-mono text-[0.5625rem]">
              F2
            </kbd>
          </Button>

          <div class="mt-1.5 grid grid-cols-3 gap-1.5">
            <button
              type="button"
              onClick={() => pos.actions.holdCart()}
              class="flex h-11 cursor-pointer items-center justify-center gap-1 rounded-[5px] border border-line-control bg-surface text-[0.6875rem] font-bold text-ink-secondary transition-colors hover:bg-hover hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
            >
              <Pause size={13} /> Tahan
            </button>
            <button
              type="button"
              onClick={() => setRecallOpen(true)}
              class="flex h-11 cursor-pointer items-center justify-center gap-1 rounded-[5px] border border-line-control bg-surface text-[0.6875rem] font-bold text-ink-secondary transition-colors hover:bg-hover hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
            >
              <ListRestart size={13} /> Panggil ({heldCount()})
            </button>
            <button
              type="button"
              onClick={() => pos.actions.go("HISTORY")}
              class="flex h-11 cursor-pointer items-center justify-center gap-1 rounded-[5px] border border-line-control bg-surface text-[0.6875rem] font-bold text-ink-secondary transition-colors hover:bg-hover hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
            >
              <History size={13} /> Riwayat
            </button>
          </div>
        </div>
      </aside>

      <UnitPicker
        product={unitProduct()}
        open={unitProduct() !== null}
        onOpenChange={(open) => {
          if (!open) setUnitProduct(null);
        }}
        onSelect={(unitId) => {
          const product = unitProduct();
          if (product) {
            pos.actions.addProduct(product.id, unitId);
          }
          setUnitProduct(null);
        }}
      />

      <Modal
        open={recallOpen()}
        onOpenChange={setRecallOpen}
        title="Panggil pesanan"
        description="Keranjang yang ditahan di perangkat ini."
        size="sm"
      >
        <Show
          when={pos.state.heldCarts().length > 0}
          fallback={
            <EmptyState
              icon={<PackageOpen size={34} stroke-width={1.6} />}
              title="Belum ada pesanan ditahan"
              description="Gunakan Tahan (F8) untuk menyimpan keranjang sementara."
            />
          }
        >
          <div class="flex flex-col gap-2">
            <For each={pos.state.heldCarts()}>
              {(held) => (
                <button
                  type="button"
                  onClick={() => {
                    pos.actions.recallCart(held.id);
                    setRecallOpen(false);
                  }}
                  class="flex w-full cursor-pointer items-center gap-2.5 rounded-[8px] border border-line bg-surface p-2.5 text-left transition-colors hover:border-primary hover:bg-primary-soft/40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
                >
                  <span class="flex size-9 shrink-0 items-center justify-center rounded-[6px] bg-primary-soft text-primary">
                    <ListRestart size={16} />
                  </span>
                  <span class="min-w-0 flex-1">
                    <span class="block truncate text-sm font-bold text-ink">
                      {held.label}
                    </span>
                    <span class="block text-[0.625rem] font-semibold text-ink-muted">
                      {cartTotals(held.lines).itemCount} baris ·{" "}
                      {formatTime(held.createdAt)}
                    </span>
                  </span>
                  <span class="shrink-0 font-mono text-sm font-bold text-ink tabular-nums">
                    {formatRupiah(cartTotals(held.lines).total)}
                  </span>
                </button>
              )}
            </For>
          </div>
        </Show>
      </Modal>
    </div>
  );
}
