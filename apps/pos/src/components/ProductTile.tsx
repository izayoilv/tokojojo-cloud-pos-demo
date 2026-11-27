import { Plus } from "lucide-solid";
import { Show } from "solid-js";

import type { PosProduct } from "../data/types";
import { formatRupiah } from "../lib/posCalc";

export function ProductTile(props: {
  product: PosProduct;
  onSelect: () => void;
}) {
  const defaultUnit = () => props.product.units[0];
  const outOfStock = () => props.product.stock <= 0;
  const multiUnit = () => props.product.units.length > 1;

  return (
    <button
      type="button"
      data-product-id={props.product.id}
      disabled={outOfStock()}
      onClick={() => props.onSelect()}
      class="group flex min-h-[104px] flex-col rounded-[8px] border border-line bg-surface p-2.5 text-left transition-colors hover:border-primary hover:bg-primary-soft/30 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus disabled:cursor-not-allowed disabled:opacity-55 disabled:hover:border-line disabled:hover:bg-surface"
    >
      <div class="flex items-center gap-1">
        <span class="truncate text-xs font-extrabold tracking-[0.08em] text-ink-muted uppercase">
          {props.product.category}
        </span>
        <Show when={outOfStock()}>
          <span class="ml-auto rounded-full bg-danger-soft px-1.5 py-0.5 text-xs font-bold text-danger">
            Habis
          </span>
        </Show>
        <Show when={!outOfStock() && multiUnit()}>
          <span class="ml-auto rounded-full bg-primary-soft px-1.5 py-0.5 text-xs font-bold text-primary">
            Pilih satuan
          </span>
        </Show>
      </div>

      <div class="mt-1 line-clamp-2 text-sm leading-snug font-bold text-ink">
        {props.product.name}
      </div>

      <div class="mt-auto flex items-end justify-between gap-2 pt-1.5">
        <div class="min-w-0">
          <div class="truncate font-mono text-sm font-bold text-ink tabular-nums">
            {formatRupiah(defaultUnit().sellingPrice)}
          </div>
          <div class="truncate text-sm font-semibold text-ink-muted">
            /{defaultUnit().name} · stok {props.product.stock}
          </div>
        </div>
        <span class="flex size-6 shrink-0 items-center justify-center rounded-full bg-subtle text-ink-secondary transition-colors group-hover:bg-primary group-hover:text-on-primary">
          <Plus size={14} />
        </span>
      </div>
    </button>
  );
}
