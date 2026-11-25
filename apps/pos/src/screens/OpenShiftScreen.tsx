import { Button, Input } from "@tokojojo/ui";
import { Banknote, CloudOff, LockKeyhole, Wallet, Wifi } from "lucide-solid";
import { createSignal, For, Show } from "solid-js";

import { usePos } from "../app/PosProvider";
import { formatDateTime } from "../lib/format";
import { formatRupiah } from "../lib/posCalc";

const quickAmounts = [100000, 200000, 500000, 1000000];

export function OpenShiftScreen() {
  const pos = usePos();
  const [openingCash, setOpeningCash] = createSignal(0);

  const offline = () =>
    pos.state.connection() === "OFFLINE" || pos.state.connection() === "GRACE";

  const updateCash = (value: string) => {
    const digits = value.replace(/\D/g, "").slice(0, 12);
    setOpeningCash(digits ? Number(digits) : 0);
  };

  return (
    <div class="flex h-full items-start justify-center overflow-y-auto bg-canvas p-4">
      <div class="my-auto w-full max-w-[520px] overflow-hidden rounded-[12px] border border-line bg-surface shadow-modal">
        <div class="flex items-center gap-3 border-b border-line px-5 py-4">
          <span class="flex size-10 shrink-0 items-center justify-center rounded-[9px] bg-primary-soft text-primary">
            <Wallet size={21} />
          </span>
          <div class="min-w-0">
            <h1 class="text-lg font-extrabold text-ink">Buka Shift</h1>
            <p class="text-xs font-semibold text-ink-muted">
              {pos.state.session()?.name ?? "Kasir"} · {pos.state.device().name}
            </p>
          </div>
          <div class="ml-auto text-right text-[0.625rem] font-semibold text-ink-muted">
            {formatDateTime(new Date())}
          </div>
        </div>

        <div class="px-5 py-4">
          <div>
            <label
              for="opening-cash"
              class="text-xs font-bold text-ink-secondary"
            >
              Modal awal kas
            </label>
            <div class="relative mt-1.5">
              <span class="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 font-mono text-sm font-bold text-ink-muted">
                Rp
              </span>
              <Input
                id="opening-cash"
                inputmode="numeric"
                autocomplete="off"
                placeholder="0"
                value={
                  openingCash() > 0 ? openingCash().toLocaleString("id-ID") : ""
                }
                onInput={(event) => updateCash(event.currentTarget.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    pos.actions.openShift(openingCash());
                  }
                }}
                autofocus
                class="h-14 pl-10 font-mono text-2xl font-bold tabular-nums"
              />
            </div>
            <p class="mt-1 text-xs text-ink-muted">
              Hitung uang fisik di drawer sebelum transaksi pertama.
            </p>
          </div>

          <div class="mt-3 flex flex-wrap gap-1.5">
            <For each={quickAmounts}>
              {(amount) => (
                <button
                  type="button"
                  onClick={() => setOpeningCash(amount)}
                  class="h-11 min-w-11 cursor-pointer rounded-[5px] border border-line-control bg-surface px-3 text-xs font-bold text-ink-secondary transition-colors hover:bg-hover hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
                >
                  {amount >= 1000000
                    ? `${amount / 1000000} jt`
                    : `${amount / 1000} rb`}
                </button>
              )}
            </For>
          </div>

          <div class="mt-4 flex items-end justify-between gap-3 rounded-[8px] border border-line bg-subtle px-4 py-3">
            <div class="flex items-center gap-2 text-xs font-bold text-ink-secondary">
              <Banknote size={16} class="text-primary" />
              Modal awal tercatat
            </div>
            <div class="font-mono text-xl font-extrabold text-ink tabular-nums">
              {formatRupiah(openingCash())}
            </div>
          </div>

          <div class="mt-3 flex items-start gap-2 rounded-[8px] border border-line px-3 py-2.5">
            <Show
              when={offline()}
              fallback={<Wifi size={15} class="mt-0.5 shrink-0 text-success" />}
            >
              <CloudOff size={15} class="mt-0.5 shrink-0 text-warning" />
            </Show>
            <div class="text-xs leading-relaxed">
              <p class="font-bold text-ink">
                {offline()
                  ? "Shift offline akan disinkronkan saat online."
                  : "Shift akan dicatat langsung ke server."}
              </p>
              <p class="text-ink-muted">
                {offline()
                  ? "Pembayaran tunai saja sampai koneksi pulih."
                  : "Transaksi tetap tersimpan lokal jika koneksi terputus."}
              </p>
            </div>
          </div>

          <Show when={pos.state.error()}>
            <p
              role="alert"
              class="mt-3 rounded-[6px] bg-danger-soft px-3 py-2 text-xs font-bold text-danger"
            >
              {pos.state.error()}
            </p>
          </Show>

          <div class="mt-4 flex flex-wrap items-center gap-2">
            <Button
              variant="primary"
              size="lg"
              class="min-w-44"
              onClick={() => pos.actions.openShift(openingCash())}
            >
              <Wallet size={16} /> Buka shift
            </Button>
            <Button
              variant="secondary"
              size="lg"
              onClick={() => pos.actions.lock()}
            >
              <LockKeyhole size={15} /> Kunci layar
            </Button>
          </div>

          <p class="mt-2 text-[0.625rem] font-semibold text-ink-muted">
            Tekan Enter untuk membuka shift. Modal awal dapat dikoreksi sebelum
            transaksi pertama.
          </p>
        </div>
      </div>
    </div>
  );
}
