import {
  Badge,
  Button,
  EmptyState,
  Modal,
  SearchInput,
  Select,
} from "@tokojojo/ui";
import {
  Ban,
  CloudOff,
  Printer,
  ReceiptText,
  RotateCcw,
  ShieldAlert,
  X,
} from "lucide-solid";
import { createEffect, createMemo, createSignal, For, Show } from "solid-js";

import { usePos } from "../app/PosProvider";
import { ReceiptPreview } from "../components/ReceiptPreview";
import type { PosSale } from "../data/types";
import { formatDate, formatDateTime, formatTime } from "../lib/format";
import {
  filterSales,
  type SaleMethodFilter,
  type SaleStatusFilter,
  saleStatusLabel,
  saleStatusTone,
} from "../lib/history";
import { paymentMethodLabels } from "../lib/payment";
import { formatRupiah } from "../lib/posCalc";

const methodOptions: SaleMethodFilter[] = [
  "ALL",
  "TUNAI",
  "QRIS",
  "DEBIT",
  "TRANSFER",
  "CAMPURAN",
  "HUTANG",
];

const statusOptions: SaleStatusFilter[] = [
  "ALL",
  "COMPLETED",
  "PARTIAL_RETURN",
  "VOIDED",
];

const statusFilterLabel = (status: SaleStatusFilter) =>
  status === "ALL" ? "Semua status" : saleStatusLabel(status);

const headerGrid =
  "grid grid-cols-[1.3fr_1fr_1fr_0.85fr_1fr_auto] items-center gap-2";

export function HistoryScreen() {
  const pos = usePos();
  const [query, setQuery] = createSignal("");
  const [method, setMethod] = createSignal<SaleMethodFilter>("ALL");
  const [status, setStatus] = createSignal<SaleStatusFilter>("ALL");
  const [selectedId, setSelectedId] = createSignal<string | null>(null);
  const [reprintOpen, setReprintOpen] = createSignal(false);
  const [confirmAction, setConfirmAction] = createSignal<
    "RETURN" | "VOID" | null
  >(null);
  const [notice, setNotice] = createSignal<string | null>(null);

  const filtered = createMemo(() =>
    filterSales(pos.state.sales(), query(), method(), status()),
  );

  const selected = createMemo(
    () => pos.state.sales().find((sale) => sale.id === selectedId()) ?? null,
  );

  createEffect(() => {
    const list = filtered();
    if (!list.some((sale) => sale.id === selectedId())) {
      setSelectedId(list[0]?.id ?? null);
    }
  });

  const canManage = () => {
    const role = pos.state.session()?.role;
    return role === "ADMIN" || role === "OWNER";
  };

  const actionReason = () => {
    const sale = selected();
    if (!sale) return null;
    if (sale.status !== "COMPLETED") {
      return "Transaksi ini sudah diretur atau di-void.";
    }
    if (pos.state.connection() !== "ONLINE") {
      return "Retur/void membutuhkan koneksi online.";
    }
    if (!canManage()) {
      return "Hanya ADMIN/OWNER yang dapat memproses retur/void.";
    }
    return null;
  };

  const methodSummary = (sale: PosSale) =>
    sale.payments
      .map((payment) => paymentMethodLabels[payment.method])
      .join(" + ");

  const runConfirmedAction = () => {
    const sale = selected();
    const action = confirmAction();
    if (!sale || !action) return;

    if (action === "RETURN") {
      pos.actions.returnSale(sale.id);
      setNotice("Retur transaksi dicatat untuk ditinjau.");
    } else {
      pos.actions.voidSale(sale.id);
      setNotice("Void transaksi dicatat.");
    }
    setConfirmAction(null);
  };

  const resetFilters = () => {
    setQuery("");
    setMethod("ALL");
    setStatus("ALL");
  };

  return (
    <div class="flex h-full min-h-0">
      <section class="flex min-w-0 flex-1 flex-col bg-canvas">
        <div class="shrink-0 border-b border-line bg-surface px-3 py-2">
          <div class="flex items-center gap-2">
            <h1 class="text-sm font-extrabold text-ink">Riwayat Transaksi</h1>
            <span class="text-[10px] font-semibold text-ink-muted">
              {filtered().length} dari {pos.state.sales().length}
            </span>
            <button
              type="button"
              onClick={resetFilters}
              class="ml-auto h-7 cursor-pointer rounded-[4px] px-2 text-[10px] font-bold text-ink-secondary hover:bg-subtle hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
            >
              Reset filter
            </button>
          </div>

          <div class="mt-1.5 flex items-center gap-1.5">
            <SearchInput
              class="min-w-0 flex-1"
              placeholder="Cari invoice, kasir, pelanggan…"
              value={query()}
              onInput={(event) => setQuery(event.currentTarget.value)}
            />
            <div class="w-[152px] shrink-0">
              <Select
                aria-label="Filter metode pembayaran"
                value={method()}
                onChange={(event) =>
                  setMethod(event.currentTarget.value as SaleMethodFilter)
                }
              >
                <For each={methodOptions}>
                  {(option) => (
                    <option value={option}>
                      {option === "ALL"
                        ? "Semua metode"
                        : paymentMethodLabels[option]}
                    </option>
                  )}
                </For>
              </Select>
            </div>
            <div class="w-[142px] shrink-0">
              <Select
                aria-label="Filter status transaksi"
                value={status()}
                onChange={(event) =>
                  setStatus(event.currentTarget.value as SaleStatusFilter)
                }
              >
                <For each={statusOptions}>
                  {(option) => (
                    <option value={option}>{statusFilterLabel(option)}</option>
                  )}
                </For>
              </Select>
            </div>
          </div>

          <Show when={pos.state.connection() !== "ONLINE"}>
            <div class="mt-2 flex items-start gap-2 rounded-[6px] bg-warning-soft px-3 py-1.5 text-[11px] text-warning">
              <CloudOff size={14} class="mt-0.5 shrink-0" />
              <p>
                <span class="font-bold">Riwayat lokal</span> ·{" "}
                {pos.state.queue().pending} transaksi menunggu sinkron.
                Retur/void membutuhkan koneksi online.
              </p>
            </div>
          </Show>

          <Show when={pos.state.error()}>
            <p
              role="alert"
              class="mt-2 rounded-[6px] bg-danger-soft px-3 py-1.5 text-[11px] font-bold text-danger"
            >
              {pos.state.error()}
            </p>
          </Show>
        </div>

        <div
          class={`${headerGrid} shrink-0 border-b border-line bg-subtle px-3 py-1.5 text-[9px] font-extrabold tracking-[0.08em] text-ink-muted uppercase`}
        >
          <span>Invoice</span>
          <span>Waktu</span>
          <span>Kasir</span>
          <span>Metode</span>
          <span class="text-right">Total</span>
          <span>Status</span>
        </div>

        <div class="min-h-0 flex-1 overflow-y-auto">
          <Show
            when={filtered().length > 0}
            fallback={
              <EmptyState
                icon={<ReceiptText size={34} stroke-width={1.6} />}
                title="Belum ada transaksi."
                description="Ubah filter atau selesaikan transaksi baru untuk melihat riwayat."
                action={
                  <Button size="sm" onClick={resetFilters}>
                    Reset filter
                  </Button>
                }
              />
            }
          >
            <For each={filtered()}>
              {(sale) => (
                <button
                  type="button"
                  data-sale-id={sale.id}
                  aria-pressed={selectedId() === sale.id}
                  onClick={() => setSelectedId(sale.id)}
                  class={`${headerGrid} w-full cursor-pointer border-b border-line px-3 py-2 text-left transition-colors hover:bg-hover focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-focus ${
                    selectedId() === sale.id
                      ? "bg-primary-soft/60"
                      : "bg-surface"
                  }`}
                >
                  <span class="truncate font-mono text-[11px] font-semibold text-ink">
                    {sale.invoice}
                  </span>
                  <span class="min-w-0">
                    <span class="block truncate text-[11px] font-semibold text-ink-secondary">
                      {formatDate(sale.time)}
                    </span>
                    <span class="block text-[10px] text-ink-muted">
                      {formatTime(sale.time)} WIB
                    </span>
                  </span>
                  <span class="truncate text-[11px] font-semibold text-ink-secondary">
                    {sale.cashier}
                  </span>
                  <span class="truncate text-[11px] text-ink-secondary">
                    {methodSummary(sale)}
                  </span>
                  <span class="text-right font-mono text-xs font-bold text-ink tabular-nums">
                    {formatRupiah(sale.total)}
                  </span>
                  <Badge tone={saleStatusTone(sale.status)}>
                    {saleStatusLabel(sale.status)}
                  </Badge>
                </button>
              )}
            </For>
          </Show>
        </div>
      </section>

      <aside class="flex w-[400px] shrink-0 flex-col border-l border-line bg-surface">
        <Show
          when={selected()}
          fallback={
            <EmptyState
              class="my-auto"
              icon={<ReceiptText size={34} stroke-width={1.6} />}
              title="Pilih transaksi"
              description="Klik salah satu transaksi untuk melihat item, pembayaran, dan aksi."
            />
          }
        >
          {(sale) => (
            <>
              <div class="shrink-0 border-b border-line px-3 py-2.5">
                <div class="flex items-start gap-2">
                  <div class="min-w-0">
                    <div class="truncate font-mono text-xs font-bold text-ink">
                      {sale().invoice}
                    </div>
                    <div class="text-[10px] font-semibold text-ink-muted">
                      {formatDateTime(sale().time)}
                    </div>
                  </div>
                  <Badge
                    tone={saleStatusTone(sale().status)}
                    class="ml-auto shrink-0"
                  >
                    {saleStatusLabel(sale().status)}
                  </Badge>
                  <button
                    type="button"
                    aria-label="Tutup detail"
                    onClick={() => setSelectedId(null)}
                    class="flex size-7 shrink-0 cursor-pointer items-center justify-center rounded-[4px] text-ink-muted hover:bg-subtle hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
                  >
                    <X size={14} />
                  </button>
                </div>

                <dl class="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-[10px]">
                  <div>
                    <dt class="font-bold text-ink-muted uppercase">Kasir</dt>
                    <dd class="truncate font-semibold text-ink">
                      {sale().cashier}
                    </dd>
                  </div>
                  <div>
                    <dt class="font-bold text-ink-muted uppercase">Shift</dt>
                    <dd class="font-semibold text-ink">
                      {sale().shiftId.replace("SHIFT-", "Shift ")}
                    </dd>
                  </div>
                  <div>
                    <dt class="font-bold text-ink-muted uppercase">
                      Pelanggan
                    </dt>
                    <dd class="truncate font-semibold text-ink">
                      {sale().customer ?? "Umum"}
                    </dd>
                  </div>
                  <div>
                    <dt class="font-bold text-ink-muted uppercase">Metode</dt>
                    <dd class="truncate font-semibold text-ink">
                      {methodSummary(sale())}
                    </dd>
                  </div>
                </dl>
              </div>

              <div class="min-h-0 flex-1 overflow-y-auto p-3">
                <div class="text-[9px] font-extrabold tracking-[0.1em] text-ink-muted uppercase">
                  Item
                </div>
                <div class="mt-1">
                  <For each={sale().items}>
                    {(item) => (
                      <div class="flex justify-between gap-2 border-b border-line py-1.5 last:border-0">
                        <div class="min-w-0">
                          <div class="truncate text-xs font-bold text-ink">
                            {item.name}
                          </div>
                          <div class="text-[10px] text-ink-muted">
                            {item.unitName} × {item.quantity} ·{" "}
                            {formatRupiah(item.unitPrice)}
                          </div>
                        </div>
                        <div class="shrink-0 font-mono text-xs font-semibold text-ink tabular-nums">
                          {formatRupiah(
                            item.quantity * item.unitPrice - item.discount,
                          )}
                        </div>
                      </div>
                    )}
                  </For>
                </div>

                <div class="mt-3 text-[9px] font-extrabold tracking-[0.1em] text-ink-muted uppercase">
                  Pembayaran
                </div>
                <div class="mt-1">
                  <For each={sale().payments}>
                    {(payment) => (
                      <div>
                        <div class="flex justify-between gap-2 text-[11px]">
                          <span class="font-semibold text-ink-secondary">
                            {paymentMethodLabels[payment.method]}
                          </span>
                          <span class="font-mono font-semibold text-ink tabular-nums">
                            {formatRupiah(payment.amount)}
                          </span>
                        </div>
                        <Show when={payment.reference}>
                          <div class="truncate text-[10px] text-ink-muted">
                            Ref: {payment.reference}
                          </div>
                        </Show>
                      </div>
                    )}
                  </For>
                  <Show when={sale().change > 0}>
                    <div class="mt-1 flex justify-between gap-2 border-t border-line pt-1 text-[11px]">
                      <span class="font-semibold text-ink-secondary">
                        Kembalian
                      </span>
                      <span class="font-mono font-semibold text-ink tabular-nums">
                        {formatRupiah(sale().change)}
                      </span>
                    </div>
                  </Show>
                </div>

                <div class="mt-2 flex items-baseline justify-between gap-2 border-t border-line-strong pt-2">
                  <span class="text-xs font-extrabold text-ink">Total</span>
                  <span class="font-mono text-lg font-extrabold text-ink tabular-nums">
                    {formatRupiah(sale().total)}
                  </span>
                </div>

                <Show when={sale().status === "PARTIAL_RETURN"}>
                  <p class="mt-2 rounded-[6px] bg-warning-soft px-2.5 py-1.5 text-[10px] font-semibold text-warning">
                    Retur sebagian dicatat. Rincian item retur tersedia pada
                    integrasi server.
                  </p>
                </Show>
                <Show when={sale().status === "VOIDED"}>
                  <p class="mt-2 rounded-[6px] bg-danger-soft px-2.5 py-1.5 text-[10px] font-semibold text-danger">
                    Transaksi void. Audit void tersimpan pada log.
                  </p>
                </Show>
              </div>

              <div class="shrink-0 border-t border-line bg-subtle p-3">
                <div class="grid grid-cols-3 gap-1.5">
                  <Button
                    size="md"
                    title="Cetak ulang struk"
                    onClick={() => setReprintOpen(true)}
                  >
                    <Printer size={14} /> Cetak
                  </Button>
                  <Button
                    size="md"
                    data-action="return"
                    disabled={actionReason() !== null}
                    onClick={() => setConfirmAction("RETURN")}
                  >
                    <RotateCcw size={14} /> Retur
                  </Button>
                  <Button
                    variant="soft-danger"
                    size="md"
                    data-action="void"
                    disabled={actionReason() !== null}
                    onClick={() => setConfirmAction("VOID")}
                  >
                    <Ban size={14} /> Void
                  </Button>
                </div>

                <Show when={actionReason()}>
                  {(reason) => (
                    <div class="mt-2 flex items-start gap-1.5 rounded-[6px] bg-warning-soft px-2.5 py-1.5 text-[10px] text-warning">
                      <ShieldAlert size={13} class="mt-0.5 shrink-0" />
                      <div class="flex-1">
                        <p class="font-semibold">{reason()}</p>
                        <Show
                          when={
                            pos.state.connection() === "ONLINE" &&
                            !canManage() &&
                            sale().status === "COMPLETED"
                          }
                        >
                          <button
                            type="button"
                            onClick={() => {
                              pos.actions.setSessionRole("OWNER");
                              setNotice(
                                "Izin demo OWNER aktif. Retur/void sekarang tersedia.",
                              );
                            }}
                            class="mt-1 cursor-pointer text-[10px] font-bold text-primary underline-offset-2 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
                          >
                            Aktifkan izin demo OWNER
                          </button>
                        </Show>
                      </div>
                    </div>
                  )}
                </Show>

                <Show when={notice()}>
                  <p
                    role="status"
                    class="mt-2 text-center text-[10px] font-bold text-success"
                  >
                    {notice()}
                  </p>
                </Show>
              </div>
            </>
          )}
        </Show>
      </aside>

      <Modal
        open={reprintOpen()}
        onOpenChange={setReprintOpen}
        title="Cetak ulang struk"
        description={selected()?.invoice}
        size="sm"
      >
        <div class="flex justify-center">
          <Show when={selected()}>
            {(sale) => (
              <ReceiptPreview
                sale={sale()}
                paperSize={pos.state.settings().paperSize}
              />
            )}
          </Show>
        </div>
        <div class="mt-3 flex justify-center gap-2">
          <Button
            variant="primary"
            onClick={() => {
              setReprintOpen(false);
              setNotice("Struk dikirim ke printer demo.");
            }}
          >
            <Printer size={15} /> Cetak struk
          </Button>
        </div>
      </Modal>

      <Modal
        open={confirmAction() !== null}
        onOpenChange={(open) => {
          if (!open) setConfirmAction(null);
        }}
        title={
          confirmAction() === "RETURN" ? "Retur transaksi?" : "Void transaksi?"
        }
        description={selected()?.invoice}
        size="sm"
        footer={
          <>
            <Button size="sm" onClick={() => setConfirmAction(null)}>
              Batal
            </Button>
            <Button
              variant={confirmAction() === "VOID" ? "soft-danger" : "primary"}
              size="sm"
              onClick={runConfirmedAction}
            >
              {confirmAction() === "RETURN" ? "Retur" : "Void"}
            </Button>
          </>
        }
      >
        <p class="text-sm leading-relaxed text-ink-secondary">
          {confirmAction() === "RETURN"
            ? "Tandai transaksi sebagai retur sebagian? Rincian item retur akan dicatat server pada integrasi."
            : "Void transaksi ini? Tindakan ini tercatat dan tidak dapat dibatalkan."}
        </p>
      </Modal>
    </div>
  );
}
