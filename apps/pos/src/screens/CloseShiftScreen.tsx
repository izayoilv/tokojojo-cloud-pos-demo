import { Button, EmptyState, Input, Modal } from "@tokojojo/ui";
import {
  Banknote,
  Clock3,
  CloudOff,
  DoorClosed,
  Printer,
  TriangleAlert,
} from "lucide-solid";
import type { JSX } from "solid-js";
import { createMemo, createSignal, For, Show } from "solid-js";

import { usePos } from "../app/PosProvider";
import { expectedCash, formatRupiah } from "../lib/posCalc";

export function CloseShiftScreen() {
  const pos = usePos();
  const [actualText, setActualText] = createSignal("");
  const [confirmOpen, setConfirmOpen] = createSignal(false);
  const [printNotice, setPrintNotice] = createSignal<string | null>(null);

  const shift = () => pos.state.shift();
  const expected = () =>
    shift()
      ? expectedCash(shift()!.openingCash, shift()!.cashSales, shift()!.refunds)
      : 0;

  const actual = () => Number(actualText() || "0");
  const hasActual = () => actualText().trim().length > 0;
  const difference = () => actual() - expected();

  const quickAmounts = createMemo(() => {
    const value = expected();
    const base = Math.max(0, Math.ceil(value / 50000) * 50000);
    return [
      ...new Set([Math.max(0, value), base, base + 50000, base + 100000]),
    ].sort((a, b) => a - b);
  });

  const updateActual = (value: string) => {
    const digits = value.replace(/\D/g, "").slice(0, 12);
    setActualText(digits);
  };

  const closeShift = () => {
    pos.actions.closeShift(actual());
    setConfirmOpen(false);
  };

  return (
    <div class="h-full overflow-y-auto bg-canvas p-4">
      <div class="mx-auto flex w-full max-w-[760px] flex-col gap-3">
        <div class="flex items-start gap-3">
          <span class="flex size-10 shrink-0 items-center justify-center rounded-[9px] bg-primary-soft text-primary">
            <Clock3 size={21} />
          </span>
          <div class="min-w-0">
            <h1 class="text-lg font-extrabold text-ink">Tutup Shift</h1>
            <p class="text-xs font-semibold text-ink-muted">
              {shift()?.id.replace("SHIFT-", "Shift ") ?? "Belum ada shift"} ·{" "}
              {shift()?.userName ?? pos.state.session()?.name ?? "Kasir"}
            </p>
          </div>
          <Button
            variant="secondary"
            size="lg"
            class="ml-auto shrink-0"
            onClick={() => pos.actions.go("SELL")}
          >
            Kembali
          </Button>
        </div>

        <Show
          when={shift()}
          fallback={
            <EmptyState
              class="rounded-[10px] border border-line bg-surface py-12"
              icon={<DoorClosed size={34} stroke-width={1.6} />}
              title="Tidak ada shift aktif"
              description="Buka shift terlebih dahulu sebelum melakukan tutup shift."
              action={
                <Button size="lg" onClick={() => pos.actions.lock()}>
                  Kunci layar
                </Button>
              }
            />
          }
        >
          {(current) => (
            <>
              <div class="grid grid-cols-3 gap-2">
                <Summary
                  label="Modal awal"
                  value={current().openingCash}
                  icon={<Banknote size={15} />}
                />
                <Summary
                  label="Penjualan tunai"
                  value={current().cashSales}
                  icon={<Banknote size={15} />}
                />
                <Summary
                  label="Refund tunai"
                  value={current().refunds}
                  tone={current().refunds > 0 ? "danger" : "neutral"}
                  icon={<TriangleAlert size={15} />}
                />
              </div>

              <div
                class={`flex items-center gap-3 rounded-[10px] border bg-surface px-4 py-3 ${
                  expected() < 0 ? "border-danger/40" : "border-line"
                }`}
              >
                <div class="min-w-0 flex-1">
                  <div class="text-[0.625rem] font-extrabold tracking-[0.12em] text-ink-muted uppercase">
                    Uang seharusnya
                  </div>
                  <div class="text-[0.625rem] font-semibold text-ink-muted">
                    Modal awal + penjualan tunai − refund
                  </div>
                </div>
                <div
                  class={`shrink-0 font-mono text-3xl font-extrabold tabular-nums ${
                    expected() < 0 ? "text-danger" : "text-ink"
                  }`}
                >
                  {formatRupiah(expected())}
                </div>
              </div>

              <Show when={expected() < 0}>
                <div class="flex items-start gap-2 rounded-[6px] bg-danger-soft px-3 py-2 text-[0.6875rem] font-semibold text-danger">
                  <TriangleAlert size={14} class="mt-0.5 shrink-0" />
                  Uang seharusnya negatif: refund tunai melebihi modal awal dan
                  penjualan tunai. Nilai tidak dibulatkan ke nol.
                </div>
              </Show>

              <div class="rounded-[10px] border border-line bg-surface p-3">
                <label
                  for="actual-cash"
                  class="text-xs font-bold text-ink-secondary"
                >
                  Uang aktual di drawer
                </label>
                <div class="relative mt-1.5">
                  <span class="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 font-mono text-sm font-bold text-ink-muted">
                    Rp
                  </span>
                  <Input
                    id="actual-cash"
                    inputmode="numeric"
                    autocomplete="off"
                    placeholder="0"
                    value={hasActual() ? actual().toLocaleString("id-ID") : ""}
                    onInput={(event) => updateActual(event.currentTarget.value)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" && hasActual()) {
                        event.preventDefault();
                        setConfirmOpen(true);
                      }
                    }}
                    autofocus
                    class="h-12 pl-10 font-mono text-xl font-bold tabular-nums"
                  />
                </div>

                <div class="mt-2 flex flex-wrap gap-1.5">
                  <For each={quickAmounts()}>
                    {(amount) => (
                      <button
                        type="button"
                        onClick={() => setActualText(String(amount))}
                        class="h-11 min-w-11 cursor-pointer rounded-[5px] border border-line-control bg-surface px-2.5 font-mono text-[0.6875rem] font-bold text-ink-secondary transition-colors hover:bg-hover hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
                      >
                        {formatRupiah(amount)}
                      </button>
                    )}
                  </For>
                  <Show when={!hasActual()}>
                    <span class="self-center text-[0.625rem] font-semibold text-ink-muted">
                      Masukkan uang aktual untuk menghitung selisih.
                    </span>
                  </Show>
                </div>

                <div class="mt-3 flex items-baseline justify-between gap-2 border-t border-line-strong pt-2">
                  <div>
                    <div class="text-xs font-extrabold text-ink">Selisih</div>
                    <div class="text-[0.625rem] font-semibold text-ink-muted">
                      Uang aktual − uang seharusnya
                    </div>
                  </div>
                  <div
                    class={`font-mono text-2xl font-extrabold tabular-nums ${
                      !hasActual()
                        ? "text-ink-muted"
                        : difference() === 0
                          ? "text-success"
                          : "text-danger"
                    }`}
                  >
                    {hasActual() ? formatRupiah(difference()) : "—"}
                  </div>
                </div>
              </div>

              <Show when={pos.state.connection() !== "ONLINE"}>
                <div class="flex items-start gap-2 rounded-[6px] bg-warning-soft px-3 py-2 text-[0.6875rem] text-warning">
                  <CloudOff size={14} class="mt-0.5 shrink-0" />
                  <p>
                    Tutup shift offline disimpan lokal pada build demo ini.
                    Sinkronisasi shift belum diaktifkan.
                  </p>
                </div>
              </Show>

              <Show when={pos.state.error()}>
                <p
                  role="alert"
                  class="rounded-[6px] bg-danger-soft px-3 py-2 text-xs font-bold text-danger"
                >
                  {pos.state.error()}
                </p>
              </Show>

              <Show when={printNotice()}>
                <p
                  role="status"
                  class="rounded-[6px] bg-success-soft px-3 py-1.5 text-[0.6875rem] font-bold text-success"
                >
                  {printNotice()}
                </p>
              </Show>

              <div class="flex flex-wrap items-center gap-2">
                <Button
                  variant="primary"
                  size="lg"
                  data-action="close-shift"
                  disabled={!hasActual()}
                  onClick={() => setConfirmOpen(true)}
                >
                  <DoorClosed size={16} /> Tutup shift
                </Button>
                <Button
                  variant="secondary"
                  size="lg"
                  onClick={() => pos.actions.go("SELL")}
                >
                  Batal
                </Button>
              </div>

              <p class="text-[0.625rem] font-semibold text-ink-muted">
                Tutup shift mengakhiri sesi kasir. Pastikan uang fisik sudah
                dihitung dan selisih sudah diperiksa.
              </p>
            </>
          )}
        </Show>
      </div>

      <Modal
        open={confirmOpen()}
        onOpenChange={setConfirmOpen}
        title="Tutup shift ini?"
        description={shift()?.id.replace("SHIFT-", "Shift ")}
        size="sm"
        footer={
          <>
            <Button size="lg" onClick={() => setConfirmOpen(false)}>
              Batal
            </Button>
            <Button
              variant="secondary"
              size="lg"
              onClick={() =>
                setPrintNotice("Ringkasan shift dikirim ke printer demo.")
              }
            >
              <Printer size={14} /> Cetak ringkasan
            </Button>
            <Button
              variant="primary"
              size="lg"
              data-action="confirm-close-shift"
              onClick={closeShift}
            >
              Tutup Shift
            </Button>
          </>
        }
      >
        <div class="space-y-1.5 text-sm">
          <div class="flex justify-between gap-2">
            <span class="text-ink-secondary">Uang seharusnya</span>
            <span class="font-mono font-bold text-ink tabular-nums">
              {formatRupiah(expected())}
            </span>
          </div>
          <div class="flex justify-between gap-2">
            <span class="text-ink-secondary">Uang aktual</span>
            <span class="font-mono font-bold text-ink tabular-nums">
              {formatRupiah(actual())}
            </span>
          </div>
          <div class="flex justify-between gap-2 border-t border-line pt-1.5">
            <span class="font-bold text-ink">Selisih</span>
            <span
              class={`font-mono font-extrabold tabular-nums ${
                difference() === 0 ? "text-success" : "text-danger"
              }`}
            >
              {formatRupiah(difference())}
            </span>
          </div>
        </div>
        <p class="mt-3 text-xs leading-relaxed text-ink-muted">
          Setelah ditutup, kasir perlu membuka shift baru untuk transaksi
          berikutnya.
        </p>
      </Modal>
    </div>
  );
}

function Summary(props: {
  label: string;
  value: number;
  icon: JSX.Element;
  tone?: "neutral" | "danger";
}) {
  return (
    <div class="rounded-[8px] border border-line bg-surface px-3 py-2">
      <div class="flex items-center gap-1 text-[0.5625rem] font-extrabold tracking-[0.08em] text-ink-muted uppercase">
        {props.icon}
        {props.label}
      </div>
      <div
        class={`mt-0.5 font-mono text-lg font-bold tabular-nums ${
          props.tone === "danger" ? "text-danger" : "text-ink"
        }`}
      >
        {formatRupiah(props.value)}
      </div>
    </div>
  );
}
