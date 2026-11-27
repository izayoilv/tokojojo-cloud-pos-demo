import { For, Show } from "solid-js";

import type { PosSale } from "../data/types";
import { formatDate, formatTime } from "../lib/format";
import { paymentMethodLabels } from "../lib/payment";
import { formatRupiah } from "../lib/posCalc";

export function ReceiptPreview(props: {
  sale: PosSale;
  paperSize: "58mm" | "80mm";
}) {
  const lineTotal = (quantity: number, unitPrice: number, discount: number) =>
    quantity * unitPrice - discount;

  return (
    <div
      class={`border border-dashed border-line-strong bg-surface px-3 py-3 font-mono text-xs leading-relaxed text-ink shadow-dropdown ${
        props.paperSize === "58mm" ? "w-[224px]" : "w-[300px]"
      }`}
      aria-label={`Pratinjau struk ${props.paperSize}`}
    >
      <div class="flex flex-col items-center gap-0.5 border-b border-dashed border-line pb-2 text-center">
        <strong class="font-sans text-sm font-extrabold tracking-[0.04em]">
          TOKO JOJO
        </strong>
        <span class="text-xs text-ink-muted">
          Komp. Ruko Niaga Mas Blok A No. 12
        </span>
        <span class="text-xs text-ink-muted">Batam Centre · 0778-468899</span>
      </div>

      <Show when={props.sale.status !== "COMPLETED"}>
        <div class="my-1.5 border-2 border-danger py-1 text-center text-xs font-extrabold tracking-[0.08em] text-danger uppercase">
          {props.sale.status === "VOIDED"
            ? "VOID · STRUK TIDAK SAH"
            : "RETUR SEBAGIAN"}
        </div>
      </Show>

      <div class="flex flex-col gap-0.5 border-b border-dashed border-line py-2 text-xs text-ink-muted">
        <span>{props.sale.invoice}</span>
        <span>
          {formatDate(props.sale.time)} {formatTime(props.sale.time)} WIB
        </span>
        <span>
          Kasir: {props.sale.cashier} ·{" "}
          {props.sale.shiftId.replace("SHIFT-", "Shift ")}
        </span>
      </div>

      <div class="py-1.5">
        <For each={props.sale.items}>
          {(item) => (
            <div class="flex justify-between gap-2 pt-1">
              <span class="min-w-0 break-words">
                {item.name}{" "}
                <span class="text-ink-muted">
                  ({item.unitName} × {item.quantity})
                </span>
              </span>
              <span class="shrink-0 tabular-nums">
                {formatRupiah(
                  lineTotal(item.quantity, item.unitPrice, item.discount),
                )}
              </span>
            </div>
          )}
        </For>
      </div>

      <div class="flex justify-between gap-2 border-t border-dashed border-line pt-1.5">
        <span>Subtotal</span>
        <span class="tabular-nums">{formatRupiah(props.sale.subtotal)}</span>
      </div>

      <Show when={props.sale.discount > 0}>
        <div class="flex justify-between gap-2">
          <span>Diskon</span>
          <span class="tabular-nums">-{formatRupiah(props.sale.discount)}</span>
        </div>
      </Show>

      <div class="mt-1 flex justify-between gap-2 border-t border-dashed border-line pt-2 font-bold">
        <span>TOTAL</span>
        <span class="tabular-nums">{formatRupiah(props.sale.total)}</span>
      </div>

      <div class="mt-1.5 border-t border-dashed border-line pt-1.5">
        <For each={props.sale.payments}>
          {(payment) => (
            <div>
              <div class="flex justify-between gap-2">
                <span>{paymentMethodLabels[payment.method]}</span>
                <span class="tabular-nums">{formatRupiah(payment.amount)}</span>
              </div>
              <Show when={payment.reference}>
                <div class="break-words text-xs text-ink-muted">
                  Ref: {payment.reference}
                </div>
              </Show>
            </div>
          )}
        </For>
        <Show when={props.sale.change > 0}>
          <div class="flex justify-between gap-2">
            <span>Kembalian</span>
            <span class="tabular-nums">{formatRupiah(props.sale.change)}</span>
          </div>
        </Show>
        <Show when={props.sale.refundedAmount}>
          {(amount) => (
            <div class="flex justify-between gap-2 text-danger">
              <span>Refund</span>
              <span class="tabular-nums">{formatRupiah(amount())}</span>
            </div>
          )}
        </Show>
      </div>

      <div class="mt-2 border-t border-dashed border-line pt-2 text-center text-xs text-ink-muted">
        Terima kasih · Barang yang sudah dibeli tidak dapat ditukar.
      </div>
    </div>
  );
}
