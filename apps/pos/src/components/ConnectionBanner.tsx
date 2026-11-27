import { ChevronRight, Clock3, WifiOff } from "lucide-solid";
import { Show } from "solid-js";

import { usePos } from "../app/PosProvider";

export function ConnectionBanner() {
  const pos = usePos();

  const visible = () =>
    pos.state.session() !== null &&
    (pos.state.connection() === "OFFLINE" ||
      pos.state.connection() === "GRACE");

  return (
    <Show when={visible()}>
      <div
        role="status"
        class={`flex shrink-0 flex-wrap items-center gap-2 border-b px-4 py-2 ${
          pos.state.connection() === "OFFLINE"
            ? "border-warning/20 bg-warning-soft text-warning"
            : "border-warning/20 bg-warning-soft text-warning"
        }`}
      >
        <Show
          when={pos.state.connection() === "OFFLINE"}
          fallback={<Clock3 size={16} class="shrink-0" />}
        >
          <WifiOff size={16} class="shrink-0" />
        </Show>
        <div class="min-w-0 flex-1">
          <div class="text-sm font-bold">
            {pos.state.connection() === "OFFLINE"
              ? `Offline · ${pos.state.queue().pending} transaksi dalam antrean`
              : "Masa tenggang · tunai saja"}
          </div>
          <div class="text-sm font-semibold text-ink-secondary">
            {pos.state.connection() === "OFFLINE"
              ? `Sinkronisasi terakhir ${pos.state.queue().lastSync}. Pembayaran tunai tetap tersedia.`
              : `Penjualan tunai ditandai untuk ditinjau. Sinkronisasi terakhir ${pos.state.queue().lastSync}.`}
          </div>
        </div>
        <button
          type="button"
          onClick={() => pos.actions.go("SYNC")}
          class="flex h-11 shrink-0 cursor-pointer items-center gap-1 rounded-[5px] border border-current/30 px-2 text-sm font-bold hover:bg-white/20 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
        >
          Sinkronisasi <ChevronRight size={12} />
        </button>
      </div>
    </Show>
  );
}
