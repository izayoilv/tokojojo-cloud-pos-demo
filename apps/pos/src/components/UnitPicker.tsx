import { Modal } from "@tokojojo/ui";
import { Package } from "lucide-solid";
import { For } from "solid-js";

import type { PosProduct } from "../data/types";
import { formatRupiah } from "../lib/posCalc";

export function UnitPicker(props: {
  product: PosProduct | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelect: (unitId: string) => void;
}) {
  return (
    <Modal
      open={props.open}
      onOpenChange={props.onOpenChange}
      title="Pilih satuan"
      description={props.product?.name}
      size="sm"
    >
      <div class="flex flex-col gap-2">
        <For each={props.product?.units ?? []}>
          {(unit) => (
            <button
              type="button"
              onClick={() => props.onSelect(unit.id)}
              class="flex w-full cursor-pointer items-center gap-3 rounded-[8px] border border-line bg-surface p-3 text-left transition-colors hover:border-primary hover:bg-primary-soft/40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
            >
              <span class="flex size-9 shrink-0 items-center justify-center rounded-[6px] bg-primary-soft text-primary">
                <Package size={17} />
              </span>
              <span class="min-w-0 flex-1">
                <span class="block text-sm font-bold text-ink">
                  {unit.name}
                </span>
                <span class="block truncate text-[0.625rem] font-semibold text-ink-muted">
                  Isi {unit.conversionQty} · {unit.barcode}
                </span>
              </span>
              <span class="shrink-0 font-mono text-sm font-bold text-ink tabular-nums">
                {formatRupiah(unit.sellingPrice)}
              </span>
            </button>
          )}
        </For>
      </div>
    </Modal>
  );
}
