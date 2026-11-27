import { Trash2 } from "lucide-solid";

import type { CartLine } from "../data/types";
import { formatRupiah } from "../lib/posCalc";

export function CartLineItem(props: {
  line: CartLine;
  onQuantity: (quantity: number) => void;
  onRemove: () => void;
}) {
  const subtotal = () =>
    props.line.quantity * props.line.unitPrice - props.line.discount;

  return (
    <div class="border-b border-line px-3 py-2 last:border-0">
      <div class="flex items-start gap-2">
        <div class="min-w-0 flex-1">
          <div class="truncate text-sm font-bold text-ink">
            {props.line.name}
          </div>
          <div class="truncate text-sm font-semibold text-ink-muted">
            {props.line.unitName} · {props.line.quantity} ×{" "}
            {formatRupiah(props.line.unitPrice)}
          </div>
        </div>
        <div class="shrink-0 font-mono text-sm font-bold text-ink tabular-nums">
          {formatRupiah(subtotal())}
        </div>
      </div>

      <div class="mt-1 flex items-center justify-between gap-2">
        <div class="flex items-center gap-1">
          <button
            type="button"
            aria-label={`Kurangi ${props.line.name}`}
            onClick={() => props.onQuantity(props.line.quantity - 1)}
            class="flex size-12 cursor-pointer items-center justify-center rounded-[5px] border border-line bg-surface text-base font-bold text-ink transition-colors hover:bg-hover active:bg-subtle focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
          >
            −
          </button>
          <span class="min-w-7 text-center font-mono text-xs font-bold text-ink tabular-nums">
            {props.line.quantity}
          </span>
          <button
            type="button"
            aria-label={`Tambah ${props.line.name}`}
            onClick={() => props.onQuantity(props.line.quantity + 1)}
            class="flex size-12 cursor-pointer items-center justify-center rounded-[5px] border border-line bg-surface text-base font-bold text-ink transition-colors hover:bg-hover active:bg-subtle focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
          >
            +
          </button>
        </div>

        <button
          type="button"
          aria-label={`Hapus ${props.line.name}`}
          onClick={() => props.onRemove()}
          class="flex h-11 cursor-pointer items-center gap-1 rounded-[4px] px-2 text-sm font-bold text-ink-muted transition-colors hover:bg-danger-soft hover:text-danger focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
        >
          <Trash2 size={12} /> Hapus
        </button>
      </div>
    </div>
  );
}
