import {
  Badge,
  Button,
  EmptyState,
  Input,
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
  const [refundText, setRefundText] = createSignal("");
  const [confirmError, setConfirmError] = createSignal<string | null>(null);
  const [notice, setNotice] = createSignal<string | null>(null);

  const filtered = createMemo(() =>
    filterSales(pos.state.sales(), query(), method(), status()),
  );

  const selected = createMemo(
    () => pos.state.sales().find((sale) => sale.id === selectedId()) ?? null,
  );

  createEffect(() => {
    const list = filtered();
    setSelectedId((current) =>
      list.some((sale) => sale.id === current)
        ? current
        : (list[0]?.id ?? null),
    );
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
    if (pos.state.shift()?.status !== "OPEN") {
      return "Buka shift aktif untuk memproses retur/void.";
    }
    return null;
  };

  const voidReason = () => {
    const reason = actionReason();
    if (reason) return reason;
    if ((selected()?.payments.length ?? 0) > 0) {
      return "Void hanya untuk transaksi tanpa pembayaran atau retur.";
    }
    return null;
  };

  const selectedHasCash = () =>
    selected()?.payments.some((payment) => payment.method === "TUNAI") ?? false;

  const methodSummary = (sale: PosSale) =>
    sale.payments
      .map((payment) => paymentMethodLabels[payment.method])
      .join(" + ");

  const runConfirmedAction = () => {
    const sale = selected();
    const action = confirmAction();
    if (!sale || !action) return;

    if (action === "RETURN") {
      const amount = Number(refundText().replace(/\D/g, ""));
      if (!amount || amount <= 0 || amount > sale.total) {
        setConfirmError(
          `Jumlah refund harus antara Rp 1 dan ${formatRupiah(sale.total)}.`,
        );
        return;
      }
      pos.actions.returnSale(sale.id, amount);
      setNotice(`Retur ${formatRupiah(amount)} dicatat untuk ditinjau.`);
    } else {
      pos.actions.voidSale(sale.id);
      setNotice("Void transaksi dicatat.");
    }

    if (pos.state.error()) {
      setConfirmError(pos.state.error());
      return;
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
            <span class="text-sm font-semibold text-ink-muted">
              {filtered().length} dari {pos.state.sales().length}
            </span>
            <div class="ml-auto flex items-center gap-1">
              <Show when={pos.state.connection() === "LOCKED"}>
                <button
                  type="button"
                  onClick={() => pos.actions.go("HARD_LOCK")}
                  class="h-11 cursor-pointer rounded-[4px] px-2 text-sm font-bold text-danger hover:bg-danger-soft focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
                >
                  Kembali ke layar terkunci
                </button>
              </Show>
              <button
                type="button"
                onClick={resetFilters}
                class="h-11 cursor-pointer rounded-[4px] px-2 text-sm font-bold text-ink-secondary hover:bg-subtle hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
              >
                Reset filter
              </button>
            </div>
          </div>

          <div class="mt-1.5 flex items-center gap-1.5">
            <SearchInput
              class="min-w-0 flex-1 [&_input]:h-11"
              aria-label="Cari transaksi"
              placeholder="Cari invoice, kasir, pelanggan…"
              value={query()}
              onInput={(event) => setQuery(event.currentTarget.value)}
            />
            <div class="w-[152px] shrink-0">
              <Select
                aria-label="Filter metode pembayaran"
                style={{ height: "44px" }}
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
                style={{ height: "44px" }}
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
            <div class="mt-2 flex items-start gap-2 rounded-[6px] bg-warning-soft px-3 py-1.5 text-sm text-warning">
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
              class="mt-2 rounded-[6px] bg-danger-soft px-3 py-1.5 text-sm font-bold text-danger"
            >
              {pos.state.error()}
            </p>
          </Show>
        </div>

        <div
          class={`${headerGrid} shrink-0 border-b border-line bg-subtle px-3 py-1.5 text-xs font-extrabold tracking-[0.08em] text-ink-muted uppercase`}
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
                  <Button size="lg" onClick={resetFilters}>
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
                  <span class="truncate font-mono text-sm font-semibold text-ink">
                    {sale.invoice}
                  </span>
                  <span class="min-w-0">
                    <span class="block truncate text-sm font-semibold text-ink-secondary">
                      {formatDate(sale.time)}
                    </span>
                    <span class="block text-sm text-ink-muted">
                      {formatTime(sale.time)} WIB
                    </span>
                  </span>
                  <span class="truncate text-sm font-semibold text-ink-secondary">
                    {sale.cashier}
                  </span>
                  <span class="truncate text-sm text-ink-secondary">
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
                    <div class="text-sm font-semibold text-ink-muted">
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
                    class="flex size-11 shrink-0 cursor-pointer items-center justify-center rounded-[4px] text-ink-muted hover:bg-subtle hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
                  >
                    <X size={14} />
                  </button>
                </div>

                <dl class="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-sm">
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
                <div class="text-xs font-extrabold tracking-[0.1em] text-ink-muted uppercase">
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
                          <div class="text-sm text-ink-muted">
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

                <div class="mt-3 text-xs font-extrabold tracking-[0.1em] text-ink-muted uppercase">
                  Pembayaran
                </div>
                <div class="mt-1">
                  <For each={sale().payments}>
                    {(payment) => (
                      <div>
                        <div class="flex justify-between gap-2 text-sm">
                          <span class="font-semibold text-ink-secondary">
                            {paymentMethodLabels[payment.method]}
                          </span>
                          <span class="font-mono font-semibold text-ink tabular-nums">
                            {formatRupiah(payment.amount)}
                          </span>
                        </div>
                        <Show when={payment.reference}>
                          <div class="truncate text-sm text-ink-muted">
                            Ref: {payment.reference}
                          </div>
                        </Show>
                      </div>
                    )}
                  </For>
                  <Show when={sale().change > 0}>
                    <div class="mt-1 flex justify-between gap-2 border-t border-line pt-1 text-sm">
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

                <Show when={sale().refundedAmount}>
                  {(amount) => (
                    <p class="mt-2 rounded-[6px] bg-danger-soft px-2.5 py-1.5 text-sm font-semibold text-danger">
                      Refund tercatat {formatRupiah(amount())}.
                    </p>
                  )}
                </Show>
                <Show when={sale().status === "PARTIAL_RETURN"}>
                  <p class="mt-2 rounded-[6px] bg-warning-soft px-2.5 py-1.5 text-sm font-semibold text-warning">
                    Retur sebagian dicatat. Rincian item retur tersedia pada
                    integrasi server.
                  </p>
                </Show>
                <Show when={sale().status === "VOIDED"}>
                  <p class="mt-2 rounded-[6px] bg-danger-soft px-2.5 py-1.5 text-sm font-semibold text-danger">
                    Transaksi void. Audit void tersimpan pada log.
                  </p>
                </Show>
                <Show when={sale().flaggedForReview}>
                  <p class="mt-2 rounded-[6px] bg-info-soft px-2.5 py-1.5 text-sm font-semibold text-info">
                    Masa tenggang: transaksi ditandai untuk ditinjau.
                  </p>
                </Show>
              </div>

              <div class="shrink-0 border-t border-line bg-subtle p-3">
                <div class="grid grid-cols-3 gap-1.5">
                  <Button
                    size="lg"
                    title="Cetak ulang struk"
                    onClick={() => setReprintOpen(true)}
                  >
                    <Printer size={14} /> Cetak
                  </Button>
                  <Button
                    size="lg"
                    data-action="return"
                    disabled={actionReason() !== null}
                    onClick={() => {
                      setRefundText(String(selected()?.total ?? ""));
                      setConfirmError(null);
                      setConfirmAction("RETURN");
                    }}
                  >
                    <RotateCcw size={14} /> Retur
                  </Button>
                  <Button
                    variant="soft-danger"
                    size="lg"
                    data-action="void"
                    disabled={voidReason() !== null}
                    title={voidReason() ?? "Void transaksi"}
                    onClick={() => {
                      setConfirmError(null);
                      setConfirmAction("VOID");
                    }}
                  >
                    <Ban size={14} /> Void
                  </Button>
                </div>

                <Show when={actionReason()}>
                  {(reason) => (
                    <div class="mt-2 flex items-start gap-1.5 rounded-[6px] bg-warning-soft px-2.5 py-1.5 text-sm text-warning">
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
                            class="mt-1 inline-flex h-11 cursor-pointer items-center text-sm font-bold text-primary underline-offset-2 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
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
                    class="mt-2 text-center text-sm font-bold text-success"
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
            size="lg"
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
          if (!open) {
            setConfirmAction(null);
            setConfirmError(null);
          }
        }}
        title={
          confirmAction() === "RETURN" ? "Retur transaksi?" : "Void transaksi?"
        }
        description={selected()?.invoice}
        size="sm"
        footer={
          <>
            <Button size="lg" onClick={() => setConfirmAction(null)}>
              Batal
            </Button>
            <Button
              variant={confirmAction() === "VOID" ? "soft-danger" : "primary"}
              size="lg"
              onClick={runConfirmedAction}
            >
              {confirmAction() === "RETURN" ? "Retur" : "Void"}
            </Button>
          </>
        }
      >
        <p class="text-sm leading-relaxed text-ink-secondary">
          {confirmAction() === "RETURN"
            ? "Tandai transaksi sebagai retur dan catat jumlah refund."
            : "Void transaksi ini? Tindakan ini tercatat dan tidak dapat dibatalkan."}
        </p>

        <Show when={confirmAction() === "VOID" && selected()}>
          {(sale) => (
            <div class="mt-3 rounded-[6px] bg-subtle px-3 py-2 text-sm leading-relaxed text-ink-secondary">
              <p>
                {selectedHasCash()
                  ? `Void tunai mengembalikan ${formatRupiah(sale().total)} dan mengurangi uang seharusnya pada shift aktif.`
                  : "Void non-tunai tidak mengurangi kas fisik; proses reversal lewat metode asal."}
              </p>
              <Show
                when={
                  selectedHasCash() && sale().shiftId !== pos.state.shift()?.id
                }
              >
                <p class="mt-1 font-bold text-warning">
                  Transaksi dari shift lain; refund tunai dibebankan ke shift
                  aktif.
                </p>
              </Show>
            </div>
          )}
        </Show>

        <Show when={confirmAction() === "RETURN" && selected()}>
          {(sale) => (
            <div class="mt-3">
              <label
                for="refund-amount"
                class="text-sm font-bold text-ink-secondary"
              >
                Jumlah refund
              </label>
              <div class="relative mt-1">
                <span class="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 font-mono text-xs font-bold text-ink-muted">
                  Rp
                </span>
                <Input
                  id="refund-amount"
                  inputmode="numeric"
                  autocomplete="off"
                  value={
                    refundText()
                      ? Number(refundText()).toLocaleString("id-ID")
                      : ""
                  }
                  onInput={(event) =>
                    setRefundText(
                      event.currentTarget.value.replace(/\D/g, "").slice(0, 12),
                    )
                  }
                  class="pl-9 font-mono"
                  style={{ height: "44px" }}
                />
              </div>
              <p class="mt-1 text-sm font-semibold text-ink-muted">
                Maksimal {formatRupiah(sale().total)}.{" "}
                {selectedHasCash()
                  ? "Refund tunai mengurangi uang seharusnya saat tutup shift."
                  : "Refund non-tunai diproses lewat metode asal dan tidak mengurangi kas fisik."}
              </p>
              <Show
                when={
                  selectedHasCash() && sale().shiftId !== pos.state.shift()?.id
                }
              >
                <p class="mt-1 text-sm font-bold text-warning">
                  Transaksi dari shift lain; refund tunai dibebankan ke shift
                  aktif.
                </p>
              </Show>
            </div>
          )}
        </Show>

        <Show when={confirmError()}>
          <p class="mt-2 text-xs font-bold text-danger">{confirmError()}</p>
        </Show>
      </Modal>
    </div>
  );
}
