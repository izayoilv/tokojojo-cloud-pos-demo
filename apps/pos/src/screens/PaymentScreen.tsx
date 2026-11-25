import { Button, Input } from "@tokojojo/ui";
import {
  ArrowLeft,
  CheckCircle2,
  Clock3,
  CloudOff,
  ShieldAlert,
} from "lucide-solid";
import { type Component, createEffect, createMemo, Show } from "solid-js";
import { Dynamic } from "solid-js/web";

import { usePos } from "../app/PosProvider";
import { useShortcuts } from "../app/useShortcuts";
import { PaymentMethodSelector } from "../components/PaymentMethodSelector";
import { paymentMethodLabel, paymentReferenceLabels } from "../lib/payment";
import { changeDue, formatRupiah } from "../lib/posCalc";

type Notice = {
  title: string;
  body: string;
  icon: Component<{ size?: number | string; class?: string }>;
  tone: "warning" | "danger";
};

const roundUp = (value: number, step: number) => Math.ceil(value / step) * step;

export function PaymentScreen() {
  const pos = usePos();

  const totals = () => pos.state.totals();
  const method = () => pos.state.paymentMethod();
  const isCash = () => method() === "TUNAI";
  const change = () => changeDue(totals().total, pos.state.cashReceived());

  const notice = createMemo<Notice | null>(() => {
    switch (pos.state.connection()) {
      case "OFFLINE":
        return {
          title: "Offline: hanya pembayaran tunai yang tersedia.",
          body: "Transaksi tunai masuk antrean dan disinkronkan saat online.",
          icon: CloudOff,
          tone: "warning",
        };
      case "GRACE":
        return {
          title: "Masa tenggang: hanya pembayaran tunai yang tersedia.",
          body: "Transaksi tunai ditandai untuk ditinjau saat perangkat kembali online.",
          icon: Clock3,
          tone: "warning",
        };
      case "LOCKED":
        return {
          title: "Terkunci: pembayaran tidak tersedia.",
          body: "Sambungkan perangkat ke server untuk melanjutkan.",
          icon: ShieldAlert,
          tone: "danger",
        };
      default:
        return null;
    }
  });

  const quickAmounts = createMemo(() => {
    const total = totals().total;
    if (total <= 0) return [];

    const candidates = [
      total,
      roundUp(total, 5000),
      roundUp(total, 10000),
      roundUp(total, 50000),
      roundUp(total, 100000),
      roundUp(total, 50000) + 50000,
    ];

    return [...new Set(candidates)]
      .filter((value) => value >= total)
      .sort((a, b) => a - b)
      .slice(0, 4);
  });

  const canComplete = () => {
    if (!method()) return false;
    if (!pos.state.paymentMethods().includes(method()!)) return false;
    if (isCash()) return pos.state.cashReceived() >= totals().total;
    return pos.state.paymentReference().trim().length > 0;
  };

  const complete = () => {
    if (canComplete()) {
      pos.actions.completeSale();
    }
  };

  createEffect(() => {
    const allowed = pos.state.paymentMethods();
    const current = pos.state.paymentMethod();
    if (allowed.length > 0 && (!current || !allowed.includes(current))) {
      pos.actions.selectPaymentMethod("TUNAI");
    }
  });

  useShortcuts({
    F2: () => complete(),
  });

  return (
    <div class="h-full overflow-y-auto bg-canvas px-4 py-3">
      <div class="mx-auto flex w-full max-w-[820px] flex-col gap-2.5">
        <div class="text-center">
          <div class="text-[0.625rem] font-extrabold tracking-[0.16em] text-ink-muted uppercase">
            Total tagihan
          </div>
          <div class="mt-0.5 font-mono text-[2.5rem] leading-none font-extrabold tracking-[-0.03em] text-ink tabular-nums">
            {formatRupiah(totals().total)}
          </div>
          <div class="mt-1 text-[0.6875rem] font-semibold text-ink-muted">
            {totals().itemCount} item · {pos.state.shift()?.id ?? "—"} ·{" "}
            {paymentMethodLabel(method())}
          </div>
        </div>

        <Show when={notice()}>
          {(current) => (
            <div
              class={`flex items-start gap-2 rounded-[8px] border px-3 py-2 ${
                current().tone === "danger"
                  ? "border-danger/30 bg-danger-soft text-danger"
                  : "border-warning/30 bg-warning-soft text-warning"
              }`}
            >
              <Dynamic
                component={current().icon}
                size={16}
                class="mt-0.5 shrink-0"
              />
              <div class="text-xs leading-relaxed">
                <p class="font-bold">{current().title}</p>
                <p class="text-ink-secondary">{current().body}</p>
              </div>
            </div>
          )}
        </Show>

        <PaymentMethodSelector
          value={method()}
          allowed={pos.state.paymentMethods()}
          onChange={(next) => pos.actions.selectPaymentMethod(next)}
        />

        <div class="rounded-[10px] border border-line bg-surface p-3">
          <Show
            when={isCash()}
            fallback={
              <div>
                <label
                  for="payment-reference"
                  class="text-xs font-bold text-ink-secondary"
                >
                  {method() ? paymentReferenceLabels[method()!] : "Referensi"}
                </label>
                <Input
                  id="payment-reference"
                  autocomplete="off"
                  placeholder="Masukkan referensi pembayaran"
                  value={pos.state.paymentReference()}
                  onInput={(event) =>
                    pos.actions.setPaymentReference(event.currentTarget.value)
                  }
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      event.preventDefault();
                      complete();
                    }
                  }}
                  autofocus
                  class="mt-1.5"
                  style={{ height: "44px" }}
                />
                <p class="mt-1 text-[0.625rem] font-semibold text-ink-muted">
                  Wajib diisi sebagai bukti pembayaran non-tunai.
                </p>
                <Show when={method() === "CAMPURAN"}>
                  <p class="mt-1 text-[0.625rem] font-semibold text-ink-muted">
                    Demo mencatat campuran sebagai satu referensi pembayaran.
                  </p>
                </Show>
                <Show when={method() === "HUTANG"}>
                  <p class="mt-1 text-[0.625rem] font-semibold text-ink-muted">
                    Hutang dicatat atas nama pelanggan dan ditinjau admin.
                  </p>
                </Show>
              </div>
            }
          >
            <div class="grid grid-cols-[1fr_auto] items-end gap-3">
              <div>
                <label
                  for="cash-received"
                  class="text-xs font-bold text-ink-secondary"
                >
                  Uang diterima
                </label>
                <div class="relative mt-1.5">
                  <span class="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 font-mono text-sm font-bold text-ink-muted">
                    Rp
                  </span>
                  <Input
                    id="cash-received"
                    inputmode="numeric"
                    autocomplete="off"
                    placeholder="0"
                    value={
                      pos.state.cashReceived() > 0
                        ? pos.state.cashReceived().toLocaleString("id-ID")
                        : ""
                    }
                    onInput={(event) =>
                      pos.actions.setCashReceived(
                        Number(event.currentTarget.value.replace(/\D/g, "")),
                      )
                    }
                    onKeyDown={(event) => {
                      if (event.key === "Enter") {
                        event.preventDefault();
                        complete();
                      }
                    }}
                    autofocus
                    class="h-12 pl-10 font-mono text-xl font-bold tabular-nums"
                  />
                </div>
              </div>

              <div class="text-right">
                <div class="text-[0.625rem] font-extrabold tracking-[0.08em] text-ink-muted uppercase">
                  {change() >= 0 ? "Kembalian" : "Kurang"}
                </div>
                <div
                  class={`font-mono text-2xl font-extrabold tabular-nums ${
                    change() >= 0 ? "text-ink" : "text-danger"
                  }`}
                >
                  {formatRupiah(Math.abs(change()))}
                </div>
              </div>
            </div>

            <div class="mt-2 flex flex-wrap gap-1.5">
              {quickAmounts().map((amount) => (
                <button
                  type="button"
                  onClick={() => pos.actions.setCashReceived(amount)}
                  class="h-11 min-w-11 cursor-pointer rounded-[5px] border border-line-control bg-surface px-2.5 font-mono text-[0.6875rem] font-bold text-ink-secondary transition-colors hover:bg-hover hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
                >
                  {formatRupiah(amount)}
                </button>
              ))}
            </div>
          </Show>
        </div>

        <Show when={pos.state.error()}>
          <p
            role="alert"
            class="rounded-[6px] bg-danger-soft px-3 py-2 text-xs font-bold text-danger"
          >
            {pos.state.error()}
          </p>
        </Show>

        <div class="flex flex-wrap items-center gap-2">
          <Button
            variant="primary"
            size="lg"
            class="min-w-56 flex-1"
            disabled={!canComplete()}
            onClick={complete}
          >
            <CheckCircle2 size={17} /> Selesaikan &amp; Cetak Struk
            <kbd class="ml-1 rounded-[3px] bg-on-primary/15 px-1 py-0.5 font-mono text-[0.5625rem]">
              F2
            </kbd>
          </Button>
          <Button
            variant="secondary"
            size="lg"
            onClick={() => pos.actions.go("SELL")}
          >
            <ArrowLeft size={16} /> Batal
          </Button>
        </div>

        <p class="text-center text-[0.625rem] font-semibold text-ink-muted">
          {isCash()
            ? "Pembayaran tunai mengubah kas shift. Pastikan uang diterima sudah dihitung."
            : "Pembayaran non-tunai membutuhkan referensi dan tidak menambah kas fisik."}
        </p>
      </div>
    </div>
  );
}
