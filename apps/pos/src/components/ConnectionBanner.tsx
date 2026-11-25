import { ChevronRight, Clock3, WifiOff } from "lucide-solid";
import { Show } from "solid-js";

import { usePos } from "../app/PosProvider";

export function ConnectionBanner() {
  const pos = usePos();

  const visible = () =>
    pos.state.connection() === "OFFLINE" || pos.state.connection() === "GRACE";

  return (
    <Show when={visible()}>
      <div
        role="status"
        class={`flex shrink-0 flex-wrap items-center gap-2 border-b px-4 py-2 ${
          pos.state.connection() === "OFFLINE"
            ? "border-warning/20 bg-warning-soft text-warning"
            : "border-accent/20 bg-accent-soft text-accent"
        }`}
      >
        <Show
          when={pos.state.connection() === "OFFLINE"}
          fallback={<Clock3 size={16} class="shrink-0" />}
        >
          <WifiOff size={16} class="shrink-0" />
        </Show>
        <div class="min-w-0 flex-1">
          <div class="text-[11px] font-bold">
            {pos.state.connection() === "OFFLINE"
              ? `Offline · ${pos.state.queue().pending} transaksi dalam antrean`
              : "Masa tenggang · tunai saja"}
          </div>
          <div class="text-[10px] font-semibold text-ink-secondary">
            {pos.state.connection() === "OFFLINE"
              ? `Sinkronisasi terakhir ${pos.state.queue().lastSync}. Pembayaran tunai tetap tersedia.`
              : `Penjualan tunai ditandai untuk ditinjau. Sinkronisasi terakhir ${pos.state.queue().lastSync}.`}
          </div>
        </div>
        <button
          type="button"
          onClick={() => pos.actions.go("SYNC")}
          class="flex h-7 shrink-0 cursor-pointer items-center gap-1 rounded-[5px] border border-current/30 px-2 text-[10px] font-bold hover:bg-white/20 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
        >
          Sinkronisasi <ChevronRight size={12} />
        </button>
      </div>
    </Show>
  );
}
